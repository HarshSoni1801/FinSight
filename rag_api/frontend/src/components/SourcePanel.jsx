import { X, FileText, Hash } from "lucide-react";

export default function SourcePanel({ activeSource, onClose }) {
  if (!activeSource) {
    return (
      <aside className="w-72 shrink-0 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Source Viewer</h3>
          <p className="text-xs text-gray-400 mt-0.5">Click a source pill to view details</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <FileText size={32} className="text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">No source selected</p>
            <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
              Click on a source pill below an answer to view the excerpt
            </p>
          </div>
        </div>
      </aside>
    );
  }

  const score = Math.round((activeSource.score || 0) * 100);
  const scoreColor = score >= 75
    ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950"
    : score >= 45
    ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950"
    : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950";

  return (
    <aside className="w-72 shrink-0 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Source Viewer</h3>
          <p className="text-xs text-gray-400 mt-0.5">Matched excerpt</p>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-lg">
            <Hash size={11} />
            Page {activeSource.page}
          </span>
          <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${
            activeSource.type === "table"
              ? "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          }`}>
            {activeSource.type === "table" ? "📊 Table" : "📄 Text"}
          </span>
          <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${scoreColor}`}>
            {score}% match
          </span>
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-gray-400 mb-1">
            <span>Relevance score</span>
            <span>{score}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                score >= 75 ? "bg-green-400" : score >= 45 ? "bg-yellow-400" : "bg-red-400"
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Excerpt
        </p>
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {activeSource.snippet}...
          </p>
        </div>
      </div>
    </aside>
  );
}