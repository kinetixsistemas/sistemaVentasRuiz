import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./icon";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: string;
  /** Clases del contenedor del icono (p. ej. "bg-primary/10 text-primary"). */
  tone?: string;
  sub?: ReactNode;
  /** Variante compacta para cuadrículas densas (p. ej. móvil). */
  compact?: boolean;
  className?: string;
}

/** Indicador (KPI) sobre superficie elevada, sin duplicar las clases de Card. */
export function StatCard({
  label,
  value,
  icon,
  tone,
  sub,
  compact = false,
  className,
}: StatCardProps) {
  return (
    <div className={cn("rounded-xl bg-surface-container-lowest shadow-card", className)}>
      <div className={cn(compact ? "flex flex-col gap-0.5 p-3" : "p-4")}>
        {(label || icon) && (
          <div className="flex items-center gap-2">
            {icon && (
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone)}>
                <Icon name={icon} size={18} />
              </span>
            )}
            <p className="text-label-md text-on-surface-variant">{label}</p>
          </div>
        )}
        <p
          className={cn(
            "tabular-nums text-on-surface",
            compact ? "text-label-lg" : "mt-3 text-numeric-currency"
          )}
        >
          {value}
        </p>
        {sub && (
          <p className={cn("text-body-sm text-on-surface-variant", compact ? "" : "mt-1")}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}