import type { EstadoFactura } from "@/types/database";
import { ESTADO_LABEL } from "./format";
import { cn } from "./cn";
import { Icon } from "./icon";

const ESTADO_ICONO: Record<EstadoFactura, string> = {
  pagada: "check_circle",
  por_vencer: "schedule",
  vencida: "error",
  pendiente: "pending_actions",
};

const ESTADO_CLASES: Record<EstadoFactura, string> = {
  pagada: "bg-status-pagada-bg text-status-pagada-text",
  por_vencer: "bg-status-por-vencer-bg text-status-por-vencer-text",
  vencida: "bg-status-vencida-bg text-status-vencida-text",
  pendiente: "bg-status-pendiente-bg text-status-pendiente-text",
};

/** Chip con el color e icono semántico del estado de una factura. */
export function EstadoChip({
  estado,
  className,
}: {
  estado: EstadoFactura;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-label-md",
        ESTADO_CLASES[estado],
        className
      )}
    >
      <Icon name={ESTADO_ICONO[estado]} size={14} strokeWidth={2.2} />
      {ESTADO_LABEL[estado]}
    </span>
  );
}

/** Exportado para listados que mostraban el estado solo con texto. */
export const estadoFacturaLabel = ESTADO_LABEL;