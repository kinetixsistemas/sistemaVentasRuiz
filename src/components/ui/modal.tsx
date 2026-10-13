"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./icon";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Pie fijo del modal (p. ej. botones de acción). */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "md:max-w-sm",
  md: "md:max-w-lg",
  lg: "md:max-w-2xl",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal responsivo: hoja inferior (bottom sheet) en móvil y modal centrado en
 * escritorio. Atrapa el foco y lo devuelve al elemento que lo abrió.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);
    const focusTimer = window.setTimeout(() => {
      const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel)?.focus();
    }, 0);

    return () => {
      document.removeEventListener("keydown", handleKey);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div
        className="absolute inset-0 animate-fade-in bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface-container-lowest shadow-overlay outline-none animate-slide-up",
          "md:m-auto md:max-h-[85vh] md:rounded-2xl",
          sizeClasses[size],
          className
        )}
      >
        <span
          className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-outline-variant md:hidden"
          aria-hidden
        />
        <header className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
          <h2 id={titleId} className="min-w-0 truncate text-headline-sm text-on-surface">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Icon name="close" size={18} strokeWidth={2} />
          </button>
        </header>
        <div className="overflow-y-auto border-t border-outline-variant p-4 sm:p-5">{children}</div>
        {footer && (
          <footer className="border-t border-outline-variant bg-surface-container-low px-4 py-3.5 sm:px-5">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
