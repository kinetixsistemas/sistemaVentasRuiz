"use client";

import type { ReactNode } from "react";
import type { CondicionFactura, EstadoFactura } from "@/types/database";
import { EstadoChip } from "@/components/ui/estado-chip";
import { Icon } from "@/components/ui/icon";
import { formatUsd } from "@/components/ui/format";
import { hoyCaracas } from "@/lib/dates";

/** Datos mínimos para pintar una fila de factura (Ventas y Cobranza). */
export type FacturaFilaDatos = {
  numero_factura: string;
  nombre_juridico: string;
  fecha_vencimiento: string;
  condicion: CondicionFactura;
  dias_mora: number;
  total_usd: number;
  saldo_usd: number;
  estado: EstadoFactura;
};

/** Saldo que la app considera cancelado (misma tolerancia que cobranza). */
const TOLERANCIA_SALDO = 0.005;

/** Días (calendario de Caracas) que faltan para el vencimiento. */
function diasHastaVencer(fechaVencimiento: string): number {
  const [anio, mes, dia] = fechaVencimiento.split("-").map(Number);
  const vence = new Date(anio!, mes! - 1, dia!);
  return Math.round((vence.getTime() - hoyCaracas().getTime()) / 86_400_000);
}

/** Texto de vencimiento para facturas a crédito aún no vencidas. */
function etiquetaVencimiento(dias: number): string {
  if (dias <= 0) return "Vence hoy";
  return `Vence en ${dias} día${dias === 1 ? "" : "s"}`;
}

/**
 * Fila compartida de facturas. A la izquierda el número, el cliente y el
 * vencimiento; a la derecha el estado y los montos (lo que debe y el total,
 * o solo el total cuando no hay abonos). El botón de cobro lo aporta cada
 * pantalla: enlace en Ventas, acción en Cobranza.
 */
export function FilaFactura({
  factura,
  onVerDetalle,
  accionCobro,
}: {
  factura: FacturaFilaDatos;
  onVerDetalle: () => void;
  accionCobro?: ReactNode;
}) {
  const tieneSaldo = factura.saldo_usd > TOLERANCIA_SALDO;
  const conAbono = factura.saldo_usd < factura.total_usd - TOLERANCIA_SALDO;

  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-label-lg tabular-nums text-on-surface">
          {factura.numero_factura}
        </p>
        <p className="truncate text-body-sm text-on-surface-variant">{factura.nombre_juridico}</p>
        {tieneSaldo && (
          <p className="mt-0.5 text-body-sm tabular-nums text-on-surface-variant">
            {factura.dias_mora > 0 ? (
              <span className="text-status-vencida-text">
                Vencida hace {factura.dias_mora} día{factura.dias_mora === 1 ? "" : "s"}
              </span>
            ) : factura.condicion === "credito" ? (
              etiquetaVencimiento(diasHastaVencer(factura.fecha_vencimiento))
            ) : (
              "De contado"
            )}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        <EstadoChip estado={factura.estado} />
        {conAbono ? (
          <>
            <p className="text-label-lg tabular-nums text-on-surface">
              {formatUsd(factura.saldo_usd)}
            </p>
            <p className="text-body-sm text-on-surface-variant">
              de <span className="tabular-nums">{formatUsd(factura.total_usd)}</span>
            </p>
          </>
        ) : (
          <p className="text-label-lg tabular-nums text-on-surface">
            {formatUsd(factura.total_usd)}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onVerDetalle}
        aria-label={`Ver detalle de factura ${factura.numero_factura}`}
        title="Ver factura completa"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Icon name="chevron_right" size={20} />
      </button>
      {accionCobro}
    </li>
  );
}
