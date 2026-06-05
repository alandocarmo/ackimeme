import { dispatchToast, ToastContainer as RealToastContainer } from "../components/ui/ToastContainer";

interface ToastActions {
  success: (title: string, msg?: string) => void;
  error: (title: string, msg?: string) => void;
  info: (title: string, msg?: string) => void;
}

/**
 * useToast — lightweight toast notification hook.
 * No external dependency needed (replaces react-hot-toast).
 *
 * Usage:
 *   const { toast, ToastContainer } = useToast();
 *   toast.success("Title", "Message");
 *   toast.error("Title", "Message");
 *   toast.info("Title", "Message");
 *   // Render <ToastContainer /> anywhere in your JSX
 */
export function useToast() {
  const toast: ToastActions = {
    success: (title: string, msg?: string) => dispatchToast({ type: "success", title, message: msg, durationMs: 4000 }),
    error: (title: string, msg?: string) => dispatchToast({ type: "error", title, message: msg, durationMs: 6000 }),
    info: (title: string, msg?: string) => dispatchToast({ type: "info", title, message: msg, durationMs: 3500 }),
  };

  return { toast, ToastContainer: RealToastContainer };
}
