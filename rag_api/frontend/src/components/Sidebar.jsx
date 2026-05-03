import { useRef, useState } from "react";
import { FileText, Upload, MessageSquare, Trash2, RotateCcw, Sun, Moon } from "lucide-react";
import logo from '../assets/Logo2_small.png';
import StatusAlert from "./StatusAlert";

export default function Sidebar({
  documents, selectedDoc, onSelectDoc,
  onUpload, uploading, uploadStatus,
  onClearHistory, chatHistory, onDeleteDocument, ingestProgress, onClearStatus
}) {
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (file) onUpload(file);
    e.target.value = "";
  }

  return (
    <aside className="w-64 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
        
        {/* LEFT: Logo */}
        <img
          src={logo}
          alt="FinSight Logo"
          className="w-14 h-14 object-contain shrink-0"
        />

        {/* RIGHT: Text */}
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900 dark:text-white text-base tracking-tight">
            FinSight
          </span>
          <p className="text-xs text-gray-400">
            Financial Document AI
          </p>
        </div>

      </div>

      {/* Upload Button */}
      <div className="px-4 py-4">
        <button
          onClick={() => fileRef.current.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
        >
          <Upload size={15} />
          {uploading ? "Processing..." : "Upload Document"}
        </button>
        <input ref={fileRef} type="file" accept=".pdf" onChange={handleFile} className="hidden" />

        {/* Progress bar */}
        {ingestProgress && (
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between items-center">
              <p className="text-xs text-blue-600 font-medium">{ingestProgress.message}</p>
              <span className="text-xs text-blue-400">{ingestProgress.percent}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${ingestProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Status message
        {uploadStatus && !ingestProgress && (
          <p className={`text-xs mt-2 px-1 leading-relaxed ${
            uploadStatus.type === "success" ? "text-green-600" :
            uploadStatus.type === "error" ? "text-red-500" : "text-gray-400"
          }`}>
            {uploadStatus.type === "success" ? "✓ " : uploadStatus.type === "error" ? "✗ " : ""}
            {uploadStatus.text}
          </p>
        )} */}
        {uploadStatus && !ingestProgress && (
          <StatusAlert
            status={uploadStatus}
            onClose={onClearStatus}
          />
        )}
      </div>

      {/* Nav */}
      <div className="px-3 mb-2">
        <div className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-medium">
          <MessageSquare size={15} />
          Documents
        </div>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
          {documents.length} document{documents.length !== 1 ? "s" : ""}
        </p>

        {documents.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <FileText size={28} className="text-gray-200 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No documents yet</p>
            <p className="text-xs text-gray-300 dark:text-gray-600">Upload a PDF to get started</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {documents.map(doc => (
              <div key={doc} className="flex items-center gap-1 group/item">
                <button
                  onClick={() => onSelectDoc(doc)}
                  className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-all ${
                    selectedDoc === doc
                      ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-medium"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    selectedDoc === doc
                      ? "bg-blue-100 dark:bg-blue-900"
                      : "bg-gray-100 dark:bg-gray-800"
                  }`}>
                    <FileText size={13} className={selectedDoc === doc ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"} />
                  </div>
                  <span className="truncate flex-1 text-xs">{doc}</span>
                  {chatHistory?.[doc]?.length > 0 && (
                    <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full shrink-0">
                      {chatHistory[doc].length}
                    </span>
                  )}
                </button>

                {chatHistory?.[doc]?.length > 0 && (
                  <button
                    onClick={() => { if (window.confirm(`Reset "${doc}"'s Chat?`)) onClearHistory(doc); }}
                    className="opacity-0 group-hover/item:opacity-100 p-1.5 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-950 text-gray-300 hover:text-yellow-500 transition-all shrink-0"
                    title="Clear chat history"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}

                <button
                  onClick={() => { if (window.confirm(`Delete "${doc}" permanently?`)) onDeleteDocument(doc); }}
                  className="opacity-0 group-hover/item:opacity-100 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-gray-300 hover:text-red-500 transition-all shrink-0"
                  title="Delete document"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}