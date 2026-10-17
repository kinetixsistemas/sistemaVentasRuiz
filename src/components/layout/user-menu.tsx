"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";

export interface UserMenuProps {
  email?: string;
  logoutAction: () => Promise<void>;
  className?: string;
}

function iniciales(email?: string): string {
  if (!email) return "U";
  const parteLocal = email.split("@")[0];
  if (!parteLocal) return "U";
  return parteLocal.slice(0, 2).toUpperCase();
}

/**
 * Borra las cachés del service worker al cerrar sesión para no dejar datos ni
 * assets de la sesión anterior en el dispositivo. No se espera el resultado:
 * el envío del formulario (logout) continúa en paralelo.
 */
function limpiarCaches() {
  if (typeof caches === "undefined") return;
  void caches.keys().then((claves) => Promise.all(claves.map((clave) => caches.delete(clave))));
}

/** Avatar con menú desplegable (Configuración / Cerrar sesión). */
export function UserMenu({ email, logoutAction, className }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Menú de usuario (${iniciales(email)})`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary text-label-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {iniciales(email)}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-56 rounded-xl bg-surface-container-lowest/95 p-2 shadow-overlay backdrop-blur-md animate-fade-in"
        >
          <p className="truncate px-3 py-2 text-body-sm text-on-surface-variant">{email}</p>
          <form action={logoutAction} onSubmit={limpiarCaches}>
            <button
              type="submit"
              role="menuitem"
              className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-label-lg text-error transition-colors hover:bg-error-container focus-visible:bg-error-container focus-visible:outline-none"
            >
              <Icon name="logout" size={20} />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}