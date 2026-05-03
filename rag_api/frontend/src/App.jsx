import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import SourcePanel from "./components/SourcePanel";
const API = "/api";

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [messages, setMessages] = useState([]);
  const [asking, setAsking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ingestProgress, setIngestProgress] = useState(null);
// { message: "Embedding batch 2/5...", percent: 60 }
  const [uploadStatus, setUploadStatus] = useState(null);
  const [docSuggestions, setDocSuggestions] = useState({});

  const [activeSource, setActiveSource] = useState(null); // sources for right panel
  const [chatHistory, setChatHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("finsight_history");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("finsight_theme") === "dark";
  });
  useEffect(() => { fetchDocuments(); }, []);

  useEffect(() => {
    if (selectedDoc && messages.length > 0) {
      const clean = messages.filter(m => !m.loading);
      if (clean.length > 0) {
        const updated = { ...chatHistory, [selectedDoc]: clean };
        setChatHistory(updated);
        localStorage.setItem("finsight_history", JSON.stringify(updated));
      }
    }
  }, [messages]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("finsight_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("finsight_theme", "light");
    }
  }, [darkMode]);
//localStorage is a browser-based key–value storage that persists data on the user's device.
// Data is saved inside the browser (not on the server) and remains even after page refresh or browser restart.
// Here, we store chat history as a JSON string under the key "finsight_history".
// Each document (doc_id) maps to its own list of messages.
// Note: localStorage only stores strings, so we use JSON.stringify / JSON.parse.
  function saveHistory(doc_id, messages) {
    // filter out loading messages before saving
    const clean = messages.filter(m => !m.loading);
    const updated = { ...chatHistory, [doc_id]: clean };
    setChatHistory(updated);
    localStorage.setItem("finsight_history", JSON.stringify(updated));
  }

  function handleClearHistory(doc_id) {
    const updated = { ...chatHistory, [doc_id]: [] };
    setChatHistory(updated);
    localStorage.setItem("finsight_history", JSON.stringify(updated));
    if (selectedDoc === doc_id) setMessages([]);
  }

  async function fetchDocuments() {
    try {
      const res = await fetch(`${API}/documents`);
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch {
      setDocuments([]);
    }
  }

  // async function handleUpload(file) {
  //   if (!file) return;
  //   setUploading(true);
  //   setUploadStatus({ type: "info", text: `Uploading ${file.name}...` });

  //   const form = new FormData();
  //   form.append("file", file);

  //   try {
  //     const res = await fetch(`${API}/upload`, { method: "POST", body: form });
  //     const data = await res.json();
  //     if (data.error) throw new Error(data.error);
  //     setUploadStatus({ type: "success", text: `Ready — ${data.chunks_created} chunks` });
  //     await fetchDocuments();
  //     setSelectedDoc(data.doc_id);
  //     setMessages([]);
  //     setActiveSource(null);
  //   } catch (err) {
  //     setUploadStatus({ type: "error", text: err.message });
  //   } finally {
  //     setUploading(false);
  //   }
  // }

  async function handleUpload(file) {
    if (!file) return;
    setUploading(true);
    setIngestProgress({ message: "Starting...", percent: 0 });
    setUploadStatus(null);
  
    const form = new FormData();
    form.append("file", file);
  
    try {
      const res = await fetch(`${API}/upload-stream`, {
        method: "POST",
        body: form,
      });
  
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
  
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
  
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
  
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
  
            if (event.type === "progress") {
              setIngestProgress({ message: event.message, percent: event.percent });
            }
  
            if (event.type === "done") {
              setIngestProgress(null);
              setUploadStatus({
                type: "success",
                text: `Ready — ${event.chunks_created} chunks from ${event.pages_processed} pages`
              });
              await fetchDocuments();
              setSelectedDoc(event.doc_id);
              setMessages(chatHistory[event.doc_id] || []);
              setActiveSource(null);

              if (event.suggestions?.length > 0) {
                setDocSuggestions(prev => ({
                  ...prev,
                  [event.doc_id]: event.suggestions
                }));
              }
            }
  
            if (event.type === "error") {
              setIngestProgress(null);
              setUploadStatus({ type: "error", text: event.message });
            }
  
          } catch (e) {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      setIngestProgress(null);
      setUploadStatus({ type: "error", text: err.message });
    } finally {
      setUploading(false);
      setIngestProgress(null);
    }
  }

  async function handleAsk(question) {
    if (!question.trim() || !selectedDoc || asking) return;

    setAsking(true);
    setActiveSource(null);
    setMessages(prev => [
      ...prev,
      { role: "user", text: question },
      { role: "assistant", loading: true }
    ]);

    try {
      const res = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: selectedDoc, question, top_k: 5 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          text: data.answer,
          confidence: data.confidence,
          sources: data.sources,
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: "assistant", text: `Error: ${err.message}`, sources: [] }
      ]);
    } finally {
      setAsking(false);
    }
  }

  async function handleRegenerate(messageIndex) {
    // messageIndex is the assistant message index
    // the question is always the message just before it
    const question = messages[messageIndex - 1]?.text;
    if (!question) return;
  
    // remove the old assistant answer and everything after it
    setMessages(prev => prev.slice(0, messageIndex-1));
  
    // re-ask the same question
    await handleAsk_stream(question);
  }

  async function handleAsk_stream(question) {
    if (!question.trim() || !selectedDoc || asking) return;
  
    setAsking(true);
    setActiveSource(null);
  
    // Add user message + empty assistant message
    setMessages(prev => [
      ...prev,
      { role: "user", text: question },
      { role: "assistant", text: "", loading: true, sources: [], confidence: null }
    ]);
  
    try {
      const res = await fetch(`${API}/ask-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: selectedDoc, question, top_k: 5 }),
      });
  
      const reader = res.body.getReader(); //reader — lets you read the response body chunk by chunk as it arrives, instead of waiting for it all
      const decoder = new TextDecoder(); //decoder — the raw data arriving is bytes (Uint8Array), not text. TextDecoder converts bytes → string
      let buffer = ""; //buffer — a temporary string to hold incomplete data between chunks
  
      while (true) {
        const { done, value } = await reader.read();//Every time you call reader.read() it gives you whatever bytes have arrived since the last time you asked.
        //value → the raw bytes that just arrived, done → boolean indicating if the stream has ended (true when no more data will arrive)
        if (done) break;
  
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line in buffer
  
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)); //
  
            if (event.type === "meta") {
              // Sources and confidence arrive first
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  sources: event.sources,
                  confidence: event.confidence,
                };
                return updated;
              });
            }
  
            if (event.type === "token") {
              // Append each token to the last message
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = {
                  ...last,
                  text: last.text + event.value,
                  loading: false,
                };
                return updated;
              });
            }
  
            if (event.type === "done") {
              setAsking(false);
            }
  
            if (event.type === "error") {
              throw new Error(event.message);
            }
  
          } catch (e) {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: "assistant", text: `Error: ${err.message}`, sources: [] }
      ]);
    } finally {
      setAsking(false);
    }
  }

  async function handleSelectDoc(doc) {
    // save current chat before switching
    if (selectedDoc && messages.length > 0) {
      saveHistory(selectedDoc, messages);
    }
    setSelectedDoc(doc);
    // load this doc's history, or empty array if none
    setMessages(chatHistory[doc] || []);
    setActiveSource(null);
      // load suggestions if not already in state

    if (!docSuggestions[doc]) {
      try {
        const res = await fetch(`${API}/suggestions/${doc}`);
        const data = await res.json();
        if (data.suggestions?.length > 0) {
          setDocSuggestions(prev => ({ ...prev, [doc]: data.suggestions }));
        }
      } catch {
        // no suggestions available
      }
    }
  }
  async function handleDeleteDocument(doc_id) {
    try {
      const res = await fetch(`${API}/documents/${doc_id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
  
      // if deleted doc was selected, clear the chat
      if (selectedDoc === doc_id) {
        setSelectedDoc(null);
        setMessages([]);
        setActiveSource(null);
      }
  
      // remove from chat history
      handleClearHistory(doc_id);
  
      // refresh document list
      await fetchDocuments();
    } catch (err) {
      console.error("Delete failed:", err.message);
    }
  }
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left Sidebar */}
      <Sidebar
        documents={documents}
        selectedDoc={selectedDoc}
        onSelectDoc={handleSelectDoc}
        onUpload={handleUpload}
        uploading={uploading}
        uploadStatus={uploadStatus}
        onClearHistory={handleClearHistory}  
        chatHistory={chatHistory}  
        onDeleteDocument={handleDeleteDocument}  
        ingestProgress={ingestProgress}  
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(prev => !prev)}
        onClearStatus={() => setUploadStatus(null)}

      />

      {/* Center Chat */}
      <ChatArea
        selectedDoc={selectedDoc}
        messages={messages}
        asking={asking}
        onAsk={handleAsk_stream}
        onSourceClick={setActiveSource}
        activeSource={activeSource}
        onRegenerate={handleRegenerate}
        suggestions={docSuggestions[selectedDoc] || []}  // ← add this
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(prev => !prev)}

      />

      {/* Right Source Panel */}
      <SourcePanel activeSource={activeSource} onClose={() => setActiveSource(null)} />
    </div>
  );
}