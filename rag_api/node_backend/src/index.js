require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const app = express();
app.use(express.json());
//Multer is a Node middleware that handles file uploads. When a request comes in with a file attached, Multer intercepts it, saves the file to the uploads/ folder, and adds req.file to the request object.
const upload = multer({ dest: "uploads/" });
const PYTHON_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";


// ─────────────────────────────────────────────
// POST /upload
// ─────────────────────────────────────────────

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }
//Now that Node.js has the file sitting on its local hard drive, it needs to send it to Python. Since Python is a different service, Node.js acts like a client (just like your browser does). 
// new FormData() creates a virtual "form." It’s a way to package the file so the Python server thinks it’s receiving a standard file upload from a web page.
  try {
    const form = new FormData();
    //By using a Stream, the Node.js server only holds a tiny "chunk" (usually 64KB) in its RAM at any given moment. It reads a chunk from the disk and immediately pushes it out the door.
    form.append("file", fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: "application/pdf",
    });

    const response = await axios.post(`${PYTHON_URL}/ingest`, form, {
      //form.getHeaders() tells the Python server: "Hey, I'm sending you a multipart message, and every time you see this specific string of characters, it means one part ended and a new one started."
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 3_600_000, // 1 hour (3.6 million ms)
   });

    res.json(response.data);
  } catch (err) {
    const message = err.response?.data?.detail || err.message;
    res.status(500).json({ error: message });
  } finally {
    // Clean up temp file
    fs.unlink(req.file.path, () => {});
  }
});

app.post("/upload-stream", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    //Take file from disk → stream it → attach it to form → send to Python as if uploaded from browser
    const form = new FormData();
    form.append("file", fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: "application/pdf",
    });

    /*1. User selects file → stays in browser memory
2. User uploads → browser sends file to Node server
3. Multer saves it to disk (uploads/)
4. Node streams file to Python
5. File is deleted from disk*/

    const response = await axios.post(`${PYTHON_URL}/ingest-stream`, form, {
      headers: form.getHeaders(),
      responseType: "stream",
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 3_600_000,
    });

    response.data.on("data", (chunk) => {
      res.write(chunk.toString());
    });

    response.data.on("end", () => {
      res.end();
    });

    response.data.on("error", () => {
      res.end();
    });

  } catch (err) {
    const message = err.response?.data?.detail || err.message;
    res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
    res.end();
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

app.get("/suggestions/:doc_id", async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_URL}/suggestions/${req.params.doc_id}`);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /ask
// ─────────────────────────────────────────────

app.post("/ask", async (req, res) => {
  const { doc_id, question, top_k = 5,use_suggestion } = req.body;

  if (!doc_id || !question) {
    return res.status(400).json({ error: "doc_id and question are required." });
  }

  try {
    const response = await axios.post(`${PYTHON_URL}/query`, {
      doc_id,
      question,
      top_k,
    }, { timeout: 120_000 });

    res.json(response.data);
  } catch (err) {
    const message = err.response?.data?.detail || err.message;
    res.status(500).json({ error: message });
  }
});


app.post("/ask-stream", async (req, res) => {
  const { doc_id, question, top_k = 5, use_suggestion } = req.body;

  if (!doc_id || !question) {
    return res.status(400).json({ error: "doc_id and question are required." });
  }

  // Set SSE headers
  // SSE — Server Sent Events. The server keeps the connection open and pushes data as it's ready.
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const response = await axios.post(`${PYTHON_URL}/query-stream`, {
      doc_id, question, top_k, use_suggestion 
    }, {
      responseType: "stream",
      timeout: 120_000
    });

    // Pipe Python SSE stream directly to client
    response.data.on("data", (chunk) => {
      // console.log(chunk.toString());
      res.write(chunk.toString());
    });

    response.data.on("end", () => {
      res.end();
    });

    response.data.on("error", (err) => {
      res.end();
    });

  } catch (err) {
    const message = err.response?.data?.detail || err.message;
    res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
    res.end();
  }
});

// ─────────────────────────────────────────────
// GET /documents
// ─────────────────────────────────────────────

app.get("/documents", async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_URL}/documents`);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/documents/:doc_id", async (req, res) => {
  const { doc_id } = req.params;
  try {
    const response = await axios.delete(`${PYTHON_URL}/documents/${doc_id}`);
    res.json(response.data);
  } catch (err) {
    const message = err.response?.data?.detail || err.message;
    res.status(500).json({ error: message });
  }
});

// ─────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────

app.get("/health", async (req, res) => {
  try {
    const py = await axios.get(`${PYTHON_URL}/health`);
    res.json({ node: "ok", python: py.data.status });
  } catch {
    res.json({ node: "ok", python: "unreachable" });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Node backend running on http://localhost:${PORT}`);
});