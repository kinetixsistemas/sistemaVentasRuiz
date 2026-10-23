import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./icon";

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Nombre de un icono (ver mapa en icon.tsx) junto al título. */
  icon?: string;
  /** Acciones del encabezado (botón "Nuevo", exportar, etc.). */
  action?: ReactNode;
  className?: string;
}

/** Encabezado de página con título grande (estilo iOS large title). */
export function PageHeader({ title, description, icon, action, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-green-500",
        className
      )}
    >
      <div className="min-w-0 border border-blue-500">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon name={icon} size={20} />
            </span>
          )}
          <h1 className="text-headline-lg-mobile text-on-surface sm:text-headline-lg">{title}</h1>
        </div>
        {description && (
          <p className="mt-1 text-body-md text-on-surface-variant">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
