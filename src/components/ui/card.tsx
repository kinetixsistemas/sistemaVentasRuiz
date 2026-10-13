import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "./cn";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Contenido opcional en el extremo derecho del encabezado (p. ej. un botón). */
  action?: ReactNode;
  contentClassName?: string;
}

/**
 * Panel estándar de tarjetas: fondo blanco, hairline y sombra en capas.
 */
export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  contentClassName,
  ...rest
}: CardProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl bg-surface-container-lowest shadow-card",
        className
      )}
      {...rest}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-headline-sm text-on-surface">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-body-sm text-on-surface-variant">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-4 sm:p-5", contentClassName)}>{children}</div>
    </section>
  );
}
