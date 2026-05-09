import { useState, useCallback, useRef } from "react";

let toastIdCounter = 0;

/**
 * useToast — lightweight toast notification hook.
 * No external dependency needed (replaces react-hot-toast).
 * 
 * Usage:
 *   const { toasts, toast, ToastContainer } = useToast();
 *   toast.success("Title", "Message");
 *   toast.error("Title", "Message");
 *   toast.info("Title", "Message");
 *   // Render <ToastContainer /> anywhere in your JSX
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const addToast = useCallback((type, title, message, durationMs = 4000) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, type, title, message, durationMs, exiting: false }]);
    timersRef.current[id] = setTimeout(() => removeToast(id), durationMs);
    return id;
  }, [removeToast]);

  const toast = {
    success: (title, msg) => addToast("success", title, msg),
    error: (title, msg) => addToast("error", title, msg, 6000),
    info: (title, msg) => addToast("info", title, msg, 3500),
  };

  function ToastContainer() {
    if (toasts.length === 0) return null;
    return (
      <div className="toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type}${t.exiting ? " toast-exit" : ""}`}
            onClick={() => {
              clearTimeout(timersRef.current[t.id]);
              removeToast(t.id);
            }}
            style={{ position: "relative", overflow: "hidden" }}
          >
            <span className="toast-icon">
              {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
            </span>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              {t.message && <div className="toast-msg">{t.message}</div>}
            </div>
            <div
              className="toast-progress"
              style={{ animationDuration: `${t.durationMs}ms` }}
            />
          </div>
        ))}
      </div>
    );
  }

  return { toasts, toast, ToastContainer };
}
