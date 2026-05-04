
import os
import tempfile
import pandas as pd
import re
from fastapi.responses import StreamingResponse
import json

from fastapi import FastAPI, UploadFile, File, HTTPException #web framework that makes your functions accessible via URLs.
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag import (
    extract_pdf, chunk_text, batch_embeddings,
    apply_better_ranking, build_context, ask_llm, ask_llm_stream,
    build_chroma_collection, search_chroma, list_chroma_collections, delete_chroma_collection, create_embedding, narrate_table, generate_question_for_chunk, save_suggestions_with_embeddings, load_suggestions_with_embeddings,search_chroma_with_embedding
)

app = FastAPI(title="FinSight", version="1.0.0")

#The ["*"] wildcard means any website can call your API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# /ingest
# ─────────────────────────────────────────────
@app.post("/ingest")
async def ingest(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported.")

    # Save upload to temp file\
    #Temp file is used because your PDF processing functions need a file path, not a stream. 
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try: 
        doc_id = file.filename.replace(".pdf", "").replace(" ", "_")

        pages = extract_pdf(tmp_path)
        chunks = chunk_text(pages)

        texts = [c["text"] for c in chunks]
        embeddings = batch_embeddings(texts,50,len(chunks))

        for i, chunk in enumerate(chunks):
            print(f"Processing chunk {i}/{len(chunks)}")
            chunk["embedding"] = embeddings[i]
            chunk["chunk_id"] = i

        build_chroma_collection(doc_id, chunks, embeddings)

        return {
            "status": "success",
            "doc_id": doc_id,
            "chunks_created": len(chunks),
            "pages_processed": len(pages)
        }
    finally:
        os.unlink(tmp_path)



@app.post("/ingest-stream")
async def ingest_stream(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported.")

    #Temp file is used because your PDF processing functions need a file path, not a stream.
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    doc_id = file.filename.replace(".pdf", "").replace(" ", "_")

    def progress(msg, percent):
        return f"data: {json.dumps({'type': 'progress', 'message': msg, 'percent': percent})}\n\n"

    def stream():
        try:
            # Instead of return which sends one thing and stops, yield sends one thing and pauses — the function stays alive and continues from that point when the next yield is hit.
            yield progress("Reading PDF...", 5)
            pages = extract_pdf(tmp_path)

            if not pages or all(not p["text"].strip() for p in pages):
                yield f"data: {json.dumps({'type': 'error', 'message': 'PDF has no readable text. It may be scanned or image-based.'})}\n\n"
                return

            yield progress(f"Extracted {len(pages)} pages. Starting chunking...", 20)
#******************************************************Chunking phase*************************************************
            print('chunking Phase. creating chunks. Num of pages: ',len(pages))
            chunks = []
            total_pages = len(pages)
            for page in pages:
                page_num = page["page_num"]
                pct = 20 + int((page_num / total_pages) * 20)
                yield progress(f"Chunking page {page_num}/{total_pages}...", pct)

                # chunk this page's text
                paragraphs = re.split(r"\n\s*\n", page["text"])
                for para in paragraphs:
                    words = para.split()
                    if len(words) < 8:
                        continue
                    if para.lower().strip() in ["table of contents"]:
                        continue
                    if len(set(words)) < 3:
                        continue
                    start = 0
                    while start < len(words):
                        chunk_words = words[start:start + 200]
                        if len(chunk_words) < 20 and start > 0:
                            break
                        chunks.append({
                            "text": " ".join(chunk_words),
                            "page_num": page_num,
                            "type": "text"
                        })
                        start += 200 - 50

                # narrate tables for this page (slow — Ollama call)
                if page.get("tables"):
                    yield progress(f"Processing tables on page {page_num}/{total_pages}...", pct)
                table_chunks = narrate_table(page.get("tables", []), page_num)
                chunks.extend(table_chunks)

            yield progress(f"Created {len(chunks)} chunks. Generating embeddings...", 40)

            if not chunks:
                yield f"data: {json.dumps({'type': 'error', 'message': 'No text chunks could be created from this PDF.'})}\n\n"
                return
#***************************************************END Chunking phase*************************************************


            yield progress(f"Created {len(chunks)} chunks. Generating embeddings...", 40)

            texts = [c["text"] for c in chunks]

            # embed in batches with progress
            all_embeddings = []
            batch_size = 50
            # By using batch_size - 1, you ensure you only get a new batch when you actually have data to fill it.
            total_batches = (len(texts) + batch_size - 1) // batch_size
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                batch_num = i // batch_size + 1
                pct = 40 + int((batch_num / total_batches) * 40)
                yield progress(f"Embedding batch {batch_num}/{total_batches}...", pct)
                try:
                    emb = create_embedding(batch)
                    all_embeddings.extend(emb)
                except Exception as e:
                    if "connection" in str(e).lower() or "refused" in str(e).lower():
                        yield f"data: {json.dumps({'type': 'error', 'message': 'Cannot reach Ollama. Make sure Ollama is running with: ollama serve'})}\n\n"
                    else:
                        yield f"data: {json.dumps({'type': 'error', 'message': f'Embedding failed: {str(e)}'})}\n\n"
                    return

            for i, chunk in enumerate(chunks):
                chunk["embedding"] = all_embeddings[i]
                chunk["chunk_id"] = i

            yield progress("Saving to ChromaDB...", 85)
            build_chroma_collection(doc_id, chunks, all_embeddings)


            yield progress("Generating recommendations...", 90)

            #always exactly 5 chunks spread evenly across document
            text_chunks = [c for c in chunks if c["type"] == "text"]

            NUM_QUESTIONS = 5

            if len(text_chunks) <= NUM_QUESTIONS:
                # fewer chunks than questions — use all of them
                selected_chunks = text_chunks
            else:
                # spread evenly: pick indices 0%, 25%, 50%, 75%, 100% through the list
                indices = [int(i * (len(text_chunks) - 1) / (NUM_QUESTIONS - 1)) for i in range(NUM_QUESTIONS)]
                selected_chunks = [text_chunks[i] for i in indices]

            # generate one question per selected chunk
            suggestions = []
            for i, chunk in enumerate(selected_chunks):
                yield progress(f"Creating recommendations...", 90 + int((i+1)/len(selected_chunks) * 8))
                q = generate_question_for_chunk(chunk["text"])
                print(f"Generated question for page {chunk['page_num']}: {q}")
                if q:
                    suggestions.append(q)

            save_suggestions_with_embeddings(doc_id, suggestions)

            yield progress("Done!", 100)
            yield f"data: {json.dumps({'type': 'done', 'doc_id': doc_id, 'chunks_created': len(chunks), 'pages_processed': len(pages), 'suggestions':suggestions})}\n\n"

        except Exception as e:
            err = str(e)
            if "connection" in err.lower() or "refused" in err.lower():
                msg = "Cannot reach Ollama. Make sure Ollama is running with: ollama serve"
            elif "pdf" in err.lower() or "plumber" in err.lower():
                msg = "Failed to read PDF. The file may be corrupted or password-protected."
            else:
                msg = f"Ingestion failed: {err}"
            yield f"data: {json.dumps({'type': 'error', 'message': msg})}\n\n"
        finally:
            os.unlink(tmp_path)

    return StreamingResponse(stream(), media_type="text/event-stream")

# ─────────────────────────────────────────────
# /query
# ─────────────────────────────────────────────

class QueryRequest(BaseModel):
    doc_id: str
    question: str
    top_k: int = 5
    use_suggestion: bool = False

@app.post("/query")
def query(req: QueryRequest):

    try:
        results = search_chroma(req.question, req.doc_id, top_k=20)
    except Exception as e:
        raise HTTPException(404, f"Document '{req.doc_id}' not found. Ingest it first.")
    
    results = apply_better_ranking(results, req.question)
    context = build_context(req.question, results, top_k=req.top_k)
    answer = ask_llm(req.question, context)

    # Build sources list
    top_results = results.head(req.top_k)
    sources = []
    for _, row in top_results.iterrows():
        sources.append({
            "page": int(row["page_num"]),
            "type": row["type"],
            "snippet": row["text"][:200].strip(),
            "score": round(float(row["final_score"]), 4)
        })


    def keyword_match_ratio(question, top_results):
        keywords = [w for w in re.findall(r"\w+", question.lower()) if len(w) > 2]
        if not keywords:
            return 0.0
        combined_text = " ".join(top_results["text"].tolist()).lower()
        matched = sum(1 for kw in keywords if kw in combined_text)
        return matched / len(keywords)

    def source_agreement(top_results):
        pages = top_results["page_num"].tolist()
        most_common_count = pd.Series(pages).value_counts().iloc[0]
        # if 4 out of 5 chunks are from page 5 → agreement = 4/5 = 0.8
        return most_common_count / len(pages)
    
    top_score = float(top_results.iloc[0]["final_score"])
    top_score = min(max(top_score, 0.0), 1.0)
    keyword_ratio = keyword_match_ratio(req.question, top_results)  # ← actually call it
    agreement = source_agreement(top_results)                        # ← actually call it
    confidence = round(top_score * 0.5 + keyword_ratio * 0.3 + agreement * 0.2, 4)
        


    return {
        "answer": answer,
        "confidence": confidence,
        "sources": sources
    }


@app.post("/query-stream")
def query_stream(req: QueryRequest):
    try:
        if req.use_suggestion:
            suggestions_data = load_suggestions_with_embeddings(req.doc_id)

            query_embedding = None
            for item in suggestions_data:
                if item["question"] == req.question:
                    query_embedding = item["embedding"]
                    break

            if query_embedding is None:
                raise HTTPException(404, "Suggestion embedding not found")
            print('question embedding: ', query_embedding)
            results = search_chroma_with_embedding(query_embedding, req.doc_id, top_k=20)

        else:
            results = search_chroma(req.question, req.doc_id, top_k=20)
    except Exception as e:
        raise HTTPException(404, f"Document '{req.doc_id}' not found. Ingest it first.")


    results = apply_better_ranking(results, req.question)
    context = build_context(req.question, results, top_k=req.top_k)

    # Build sources + confidence (same as /query)
    top_results = results.head(req.top_k)
    sources = []
    for _, row in top_results.iterrows():
        sources.append({
            "page": int(row["page_num"]),
            "type": row["type"],
            "snippet": row["text"][:200].strip(),
            "score": round(float(row["final_score"]), 4)
        })

    def keyword_match_ratio(question, top_results):
        keywords = [w for w in re.findall(r"\w+", question.lower()) if len(w) > 2]
        if not keywords:
            return 0.0
        combined_text = " ".join(top_results["text"].tolist()).lower()
        matched = sum(1 for kw in keywords if kw in combined_text)
        return matched / len(keywords)

    def source_agreement(top_results):
        pages = top_results["page_num"].tolist()
        most_common_count = pd.Series(pages).value_counts().iloc[0]
        return most_common_count / len(pages)

    top_score = min(max(float(top_results.iloc[0]["final_score"]), 0.0), 1.0)
    keyword_ratio = keyword_match_ratio(req.question, top_results)
    agreement = source_agreement(top_results)
    confidence = round(top_score * 0.5 + keyword_ratio * 0.3 + agreement * 0.2, 4)

    def stream():
        # First send metadata (sources + confidence) as a special event
        meta = json.dumps({ "type": "meta", "sources": sources, "confidence": confidence })
        yield f"data: {meta}\n\n"

        # Then stream tokens one by one
        for token in ask_llm_stream(req.question, context):
            if token:
                payload = json.dumps({ "type": "token", "value": token })
                yield f"data: {payload}\n\n"

        # Send done signal
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.get("/suggestions/{doc_id}")
def get_suggestions(doc_id: str):
    suggestions = load_suggestions_with_embeddings(doc_id)
    
    # return only text for frontend
    questions = [s["question"] for s in suggestions]

    return {"suggestions": questions}

@app.get("/documents")
def list_documents():
    try:
        docs = list_chroma_collections()
    except:
        docs = []
    return {"documents": docs}

@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    try:
        delete_chroma_collection(doc_id)
        return { "status": "success", "doc_id": doc_id }
    except Exception as e:
        raise HTTPException(404, f"Document '{doc_id}' not found.")

@app.get("/health")
def health():
    return {"status": "ok"}