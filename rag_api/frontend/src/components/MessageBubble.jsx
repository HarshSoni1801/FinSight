import { useState } from "react";
import { Copy, Check, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import logo_small from '../assets/Logo2_small.png';

function ConfidencePill({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75
    ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400"
    : pct >= 45
    ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-400"
    : "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400";
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {pct}% confidence
    </span>
  );
}

export default function MessageBubble({ msg, onSourceClick, activeSource, onRegenerate, asking }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";

  function handleCopy() {
    navigator.clipboard.writeText(msg.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%] bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%] space-y-2">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <img src={logo_small} alt="FinSight Logo" className="w-7 h-7 mt-2 object-contain shrink-0"/>
          </div>

          <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
            {msg.loading ? (
              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                Analyzing document...
              </div>
            ) : (
              <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    table: ({node, ...props}) => (
                      <div className="overflow-x-auto my-3">
                        <table className="w-full text-xs border-collapse border border-gray-200 dark:border-gray-700 rounded-lg" {...props} />
                      </div>
                    ),
                    thead: ({node, ...props}) => (
                      <thead className="bg-gray-50 dark:bg-gray-700" {...props} />
                    ),
                    th: ({node, ...props}) => (
                      <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300" {...props} />
                    ),
                    td: ({node, ...props}) => (
                      <td className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-gray-600 dark:text-gray-400" {...props} />
                    ),
                    strong: ({node, ...props}) => (
                      <strong className="font-semibold text-gray-900 dark:text-gray-100" {...props} />
                    ),
                    ul: ({node, ...props}) => (
                      <ul className="list-disc list-inside space-y-1 my-2" {...props} />
                    ),
                    ol: ({node, ...props}) => (
                      <ol className="list-decimal list-inside space-y-1 my-2" {...props} />
                    ),
                    p: ({node, ...props}) => (
                      <p className="mb-2 last:mb-0" {...props} />
                    ),
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {!msg.loading && !isUser && msg.text && (
          <div className="ml-10 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={onRegenerate}
                disabled={asking}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw size={12} className={asking ? "animate-spin" : ""} />
                Regenerate
              </button>
              {msg.confidence !== undefined && (
                <ConfidencePill value={msg.confidence} />
              )}
            </div>

            {msg.sources?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-gray-400 self-center">Sources:</span>
                {msg.sources.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => onSourceClick(src)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      activeSource === src
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      src.type === "table" ? "bg-purple-400" : "bg-blue-400"
                    } ${activeSource === src ? "bg-white" : ""}`} />
                    Page {src.page}
                    <span className="opacity-60">{src.type === "table" ? "· table" : "· text"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}