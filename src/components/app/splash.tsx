"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import { NOMBRE_APP } from "@/components/layout/brand";

const MIN_VISIBLE_MS = 600;
const MAX_VISIBLE_MS = 4000;
const FADE_MS = 300;

type Fase = "visible" | "saliendo" | "oculto";

/**
 * Pantalla de carga inicial con el logo de Kinetix.
 *
 * Se muestra mientras la app arranca (evento `load` del navegador) y se
 * desvanece sola. Solo aparece en la carga completa: la navegación interna
 * sigue usando el esqueleto de `(app)/loading.tsx`.
 */
export function Splash() {
  const [fase, setFase] = useState<Fase>("visible");

  useEffect(() => {
    const inicio = Date.now();
    const temporizadores: ReturnType<typeof setTimeout>[] = [];
    let programada = false;

    const programarSalida = () => {
      if (programada) return;
      programada = true;
      const restante = Math.max(0, MIN_VISIBLE_MS - (Date.now() - inicio));
      temporizadores.push(
        setTimeout(() => {
          setFase("saliendo");
          temporizadores.push(setTimeout(() => setFase("oculto"), FADE_MS));
        }, restante)
      );
    };

    if (document.readyState === "complete") programarSalida();
    else window.addEventListener("load", programarSalida, { once: true });

    // Red de seguridad: la pantalla nunca debe quedarse tapando la app.
    temporizadores.push(setTimeout(programarSalida, MAX_VISIBLE_MS));

    return () => {
      window.removeEventListener("load", programarSalida);
      temporizadores.forEach(clearTimeout);
    };
  }, []);

  if (fase === "oculto") return null;

  return (
    <div
      role="status"
      aria-label="Cargando la aplicación"
      aria-busy
      style={{ transitionDuration: `${FADE_MS}ms` }}
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-background transition-opacity",
        fase === "saliendo" && "pointer-events-none opacity-0"
      )}
    >
      <Image
        src="/kinetixLogo.webp"
        alt={NOMBRE_APP}
        width={160}
        height={160}
        priority
        className="h-36 w-36 object-contain"
      />
      <div className="flex flex-col items-center gap-1">
        <p className="text-headline-sm font-bold text-on-surface">{NOMBRE_APP}</p>
        <p className="text-label-sm text-on-surface-variant">Cargando…</p>
      </div>
    </div>
  );
}
