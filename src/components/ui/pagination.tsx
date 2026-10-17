"use client";

import { cn } from "./cn";
import { Icon } from "./icon";

export interface PaginationProps {
  /** Página actual (1-based). */
  pagina: number;
  /** Total de registros del listado (no de la página). */
  total: number;
  porPagina: number;
  /** Se invoca con la página destino. */
  onCambiar: (pagina: number) => void;
  /** Atenúa el control mientras llega la página solicitada. */
  cargando?: boolean;
  className?: string;
}

/**
 * Controles de paginación para listados largos. Muestra el rango visible y
 * botones anterior/siguiente; no renderiza nada si solo hay una página.
 */
export function Pagination({
  pagina,
  total,
  porPagina,
  onCambiar,
  cargando = false,
  className,
}: PaginationProps) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (total === 0 || paginas <= 1) return null;

  const primera = (pagina - 1) * porPagina + 1;
  const ultima = Math.min(pagina * porPagina, total);

  return (
    <nav
      aria-label="Paginación"
      className={cn(
        "flex items-center justify-between gap-3 px-1 pt-1 transition-opacity",
        cargando && "opacity-60",
        className
      )}
    >
      <button
        type="button"
        onClick={() => onCambiar(pagina - 1)}
        disabled={pagina <= 1 || cargando}
        aria-label="Página anterior"
        className="flex h-10 items-center gap-1 rounded-lg px-3 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Icon name="chevron_left" size={18} />
        <span className="hidden sm:inline">Anterior</span>
      </button>

      <p className="text-body-sm tabular-nums text-on-surface-variant">
        {primera}–{ultima} de {total}
        <span className="hidden sm:inline"> · Página {pagina} de {paginas}</span>
      </p>

      <button
        type="button"
        onClick={() => onCambiar(pagina + 1)}
        disabled={pagina >= paginas || cargando}
        aria-label="Página siguiente"
        className="flex h-10 items-center gap-1 rounded-lg px-3 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="hidden sm:inline">Siguiente</span>
        <Icon name="chevron_right" size={18} />
      </button>
    </nav>
  );
}
