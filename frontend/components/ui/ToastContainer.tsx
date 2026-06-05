import React, { useState, useCallback, useRef, useEffect } from "react";

// Event emitter logic for toasts
export let toastIdCounter = 0;

export interface Toast {
  id: number;
  type: "success" | "error" | "info";
  title: string;
  message?: string;
  durationMs: number;
  exiting: boolean;
}

export type NotifyPayload = Omit<Toast, "id" | "exiting">;

const listeners = new Set<(payload: NotifyPayload) => void>();

export function subscribeToasts(listener: (payload: NotifyPayload) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function dispatchToast(payload: NotifyPayload) {
  listeners.forEach((l) => l(payload));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: number): void => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  useEffect(() => {
    const handleNotify = (payload: NotifyPayload) => {
      const id = ++toastIdCounter;
      setToasts((prev) => [...prev, { ...payload, id, exiting: false }]);
      timersRef.current[id] = setTimeout(() => removeToast(id), payload.durationMs);
    };

    return subscribeToasts(handleNotify);
  }, [removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          aria-live="polite"
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
