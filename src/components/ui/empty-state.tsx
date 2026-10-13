import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./icon";

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  /** Acción opcional (p. ej. un botón de "Crear"). */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-4 py-12 text-center",
        className
      )}
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name={icon} size={30} strokeWidth={1.6} />
      </span>
      <h3 className="text-headline-sm text-on-surface">{title}</h3>
      {description && (
        <p className="max-w-sm text-body-md text-on-surface-variant">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
