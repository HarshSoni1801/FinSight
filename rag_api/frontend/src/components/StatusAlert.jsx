import { useEffect } from "react";
import { CheckCircle, XCircle, Info } from "lucide-react";

export default function StatusAlert({
  status,        // { type: "success" | "error" | "info", text: string }
  onClose,       // function to clear status
  duration = 6000 // auto dismiss time (ms)
}) {
   useEffect(() => {
      if (!status) return;
      console.log(status);
      const timer = setTimeout(() => {
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }, [status, duration, onClose]);  // ← add onClose and duration to deps

  if (!status) return null;

  const styles =
    status.type === "success"
      ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
      : status.type === "error"
      ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
      : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400";

  return (
    <div
      className={`flex items-start gap-2 mt-2 px-3 py-2 rounded-lg text-xs border shadow-sm
                  animate-fadeIn transition-all ${styles}`}
    >
      {/* Icon */}
      <span className="mt-[1px]">
        {status.type === "success" && <CheckCircle size={14} />}
        {status.type === "error" && <XCircle size={14} />}
        {!["success", "error"].includes(status.type) && <Info size={14} />}
      </span>

      {/* Text */}
      <span className="flex-1">{status.text}</span>

      {/* Close button */}
      <button
        onClick={onClose}
        className="text-xs opacity-60 hover:opacity-100 ml-2"
      >
        ✕
      </button>
    </div>
  );
}