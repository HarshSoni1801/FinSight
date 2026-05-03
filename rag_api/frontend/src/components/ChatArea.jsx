import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import MessageBubble from "./MessageBubble";
import { Sun, Moon } from "lucide-react";
import logo from '../assets/Logo2.png';




const SUGGESTIONS = [
  "What was the total revenue?",
  "What is the gross margin?",
  "Who are the key executives?",
  "What are the main business risks?",
  "Summarize the financial highlights",
];

export default function ChatArea({
  selectedDoc, messages, asking, onAsk, onSourceClick, activeSource, onRegenerate, suggestions, darkMode, onToggleDark
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!input.trim() || !selectedDoc || asking) return;
    onAsk(input.trim());
    setInput("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSuggestion(s) {
    if (!selectedDoc) return;
    onAsk(s);
  }

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 shrink-0 flex items-center justify-between">
  
        <div className="flex items-center gap-2">
          {selectedDoc ? (
            <>
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {selectedDoc}
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-400">No document selected</span>
          )}
        </div>

        {/* Animated toggle */}
        <button
          onClick={onToggleDark}
          className="relative p-2 rounded-xl transition-all duration-300 
                    hover:bg-gray-100 dark:hover:bg-gray-800 
                    text-gray-500 dark:text-gray-400
                    hover:scale-110 active:scale-95"
        >
          <span
            className={`inline-block transition-all duration-500 ${
              darkMode
                ? "rotate-180 scale-110 text-yellow-400"
                : "rotate-0 scale-100 text-gray-500"
            }`}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </span>

          <span
            className={`absolute inset-0 rounded-xl transition-all duration-300 ${
              darkMode
                ? "bg-yellow-400/10 blur-md opacity-100"
                : "bg-transparent opacity-0"
            }`}
          />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-1">

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center px-4 ">
                <img src={logo} alt="FinSight Logo" className="w-[300px] h-[300px] mt-10 opacity-30 object-contain shrink-0"/>
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                Ask questions about your documents
              </h2>
              <p className="text-gray-400 dark:text-gray-500 text-sm mb-8 max-w-md">
                {selectedDoc
                  ? `You're analyzing "${selectedDoc}". Try one of the suggestions below.`
                  : "Upload a PDF document from the sidebar to get started."}
              </p>
              {selectedDoc && (
                // NEW
                <div className="flex flex-wrap gap-2 justify-center max-w-lg w-full">
                  {(suggestions.length > 0 ? suggestions : SUGGESTIONS).map(s => (
                    <button
                      key={s}
                      onClick={() => handleSuggestion(s)}
                      className="w-[calc(50%-4px)] px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 text-gray-600 dark:text-gray-400 hover:text-blue-700 dark:hover:text-blue-400 text-sm rounded-xl transition-all shadow-sm text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              msg={msg}
              onSourceClick={onSourceClick}
              activeSource={activeSource}
              onRegenerate={() => onRegenerate(i)}
              asking={asking}
            />
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-4 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm focus-within:border-blue-400 dark:focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedDoc ? "Ask anything about your document..." : "Select a document first..."}
              disabled={!selectedDoc || asking}
              className="flex-1 resize-none bg-transparent text-sm text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-600 disabled:opacity-50 max-h-32 leading-relaxed"
              style={{ height: "24px" }}
              onInput={e => {
                e.target.style.height = "24px";
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
              }}
            />
            <button
              onClick={handleSend}
              disabled={!selectedDoc || !input.trim() || asking}
              className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-400 rounded-xl transition-all shrink-0"
            >
              <Send size={14} />
            </button>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-600 text-center mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </main>
  );
}