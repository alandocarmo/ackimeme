import React, { useState, useCallback, useRef } from "react";

let toastIdCounter = 0;

interface Toast {
  id: number;
  type: "success" | "error" | "info";
  title: string;
  message?: string;
  durationMs: number;
  exiting: boolean;
}

interface ToastActions {
  success: (title: string, msg?: string) => number;
  error: (title: string, msg?: string) => number;
  info: (title: string, msg?: string) => number;
}

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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: number): void => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const addToast = useCallback((type: Toast["type"], title: string, message?: string, durationMs: number = 4000): number => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, type, title, message, durationMs, exiting: false }]);
    timersRef.current[id] = setTimeout(() => removeToast(id), durationMs);
    return id;
  }, [removeToast]);

  const toast: ToastActions = {
    success: (title: string, msg?: string) => addToast("success", title, msg),
    error: (title: string, msg?: string) => addToast("error", title, msg, 6000),
    info: (title: string, msg?: string) => addToast("info", title, msg, 3500),
  };

  function ToastContainer(): React.JSX.Element | null {
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
