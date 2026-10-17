"use client";

import { useState } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { Icon } from "./icon";
import { Input } from "./input";

export interface FiltroFechasProps {
  /** Rango aplicado (valores controlados por el padre). */
  desde: string;
  hasta: string;
  /** Se invoca al aplicar un rango válido. Cadenas vacías = sin rango. */
  onAplicar: (desde: string, hasta: string) => void;
  /** Se invoca al limpiar el rango. */
  onLimpiar: () => void;
  cargando?: boolean;
  className?: string;
}

/**
 * Filtro colapsable de rango de fechas. Mantiene un borrador interno para que
 * el usuario escriba las dos fechas y recién entonces aplique el filtro.
 */
export function FiltroFechas({
  desde,
  hasta,
  onAplicar,
  onLimpiar,
  cargando = false,
  className,
}: FiltroFechasProps) {
  const [abierto, setAbierto] = useState(() => Boolean(desde || hasta));
  // El borrador arranca del rango aplicado; se reinicia al aplicar o limpiar,
  // y ante un remonte (navegación por URL) vuelve a sembrarse desde las props.
  const [dDesde, setDDesde] = useState(desde);
  const [dHasta, setDHasta] = useState(hasta);

  const activo = Boolean(desde || hasta);
  const incompleto = (dDesde !== "") !== (dHasta !== "");
  const invalido = dDesde !== "" && dHasta !== "" && dDesde > dHasta;
  const hayBorrador = dDesde !== "" || dHasta !== "";

  function aplicar() {
    if (incompleto || invalido) return;
    onAplicar(dDesde, dHasta);
  }

  function limpiar() {
    setDDesde("");
    setDHasta("");
    onLimpiar();
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-pressed={activo}
          className={cn(
            "flex h-9 items-center gap-2 rounded-full px-3.5 text-label-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            activo
              ? "bg-primary text-on-primary"
              : "bg-surface-container text-on-surface-variant hover:text-on-surface"
          )}
        >
          <Icon name="calendar_month" size={18} />
          Fechas
          {activo && <Icon name="close" size={16} />}
        </button>
        {activo && !abierto && (
          <span className="truncate text-body-sm text-on-surface-variant">
            {desde} → {hasta}
          </span>
        )}
      </div>

      {abierto && (
        <div className="flex flex-col gap-3 rounded-xl bg-surface-container p-3 sm:flex-row sm:items-end">
          <Input
            label="Desde"
            name="filtro_desde"
            type="date"
            value={dDesde}
            max={dHasta || undefined}
            onChange={(e) => setDDesde(e.target.value)}
          />
          <Input
            label="Hasta"
            name="filtro_hasta"
            type="date"
            value={dHasta}
            min={dDesde || undefined}
            onChange={(e) => setDHasta(e.target.value)}
            error={invalido ? "El rango no es válido." : undefined}
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon="filter"
              disabled={incompleto || invalido || cargando}
              loading={cargando}
              onClick={aplicar}
            >
              Aplicar
            </Button>
            {hayBorrador && (
              <Button variant="ghost" onClick={limpiar} disabled={cargando}>
                Limpiar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
