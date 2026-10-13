"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "./cn";
import { Icon } from "./icon";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const config: Record<
  ToastKind,
  { icon: string; container: string; iconColor: string; accent: string; duration: number }
> = {
  success: {
    icon: "check_circle",
    container: "bg-status-pagada-bg",
    iconColor: "text-status-pagada-text",
    accent: "bg-status-pagada-text",
    duration: 4000,
  },
  error: {
    icon: "error",
    container: "bg-error-container",
    iconColor: "text-on-error-container",
    accent: "bg-error",
    // Los errores duran más: suelen requerir leer y corregir algo.
    duration: 7000,
  },
  info: {
    icon: "info",
    container: "bg-surface-container-lowest",
    iconColor: "text-primary",
    accent: "bg-primary",
    duration: 4000,
  },
};

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const { icon, container, iconColor, accent } = config[toast.kind];
  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto relative flex w-full max-w-sm items-start gap-2.5 overflow-hidden rounded-xl py-3 pl-4 pr-2 shadow-overlay animate-slide-down",
        container
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", accent)} />
      <Icon name={icon} size={20} className={cn("mt-0.5", iconColor)} />
      <p className="min-w-0 flex-1 text-body-md text-on-surface">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar aviso"
        className="-mr-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-2), { id, kind, message }]);
      const timer = window.setTimeout(() => dismiss(id), config[kind].duration);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  useEffect(() => {
    const pendientes = timers.current;
    return () => {
      pendientes.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-20 z-[100] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:right-4 md:items-end"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
