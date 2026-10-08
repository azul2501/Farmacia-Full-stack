"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

export type ToastTone = "success" | "error" | "warning" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
};

type ToastItem = ToastInput & {
  id: number;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneIcons: Record<ToastTone, string> = {
  success: "fas fa-check-circle",
  error: "fas fa-times-circle",
  warning: "fas fa-exclamation-triangle",
  info: "fas fa-info-circle",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      const item: ToastItem = { ...input, id, tone: input.tone ?? "info" };
      setToasts((current) => [...current, item]);
      window.setTimeout(() => dismiss(id), input.duration ?? 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <article className={`app-toast toast-${toast.tone}`} key={toast.id} role="status">
            <i className={toneIcons[toast.tone]} aria-hidden="true" />
            <div>
              <strong>{toast.title}</strong>
              {toast.description ? <p>{toast.description}</p> : null}
            </div>
            <button type="button" aria-label="Cerrar mensaje" onClick={() => dismiss(toast.id)}>
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast debe usarse dentro de ToastProvider");
  return context;
}
