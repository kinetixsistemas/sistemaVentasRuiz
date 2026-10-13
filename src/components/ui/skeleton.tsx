import { cn } from "./cn";

export interface SkeletonProps {
  className?: string;
  /** Forma circular (p. ej. avatares). */
  circle?: boolean;
}

/** Bloque placeholder durante el loading de datos. */
export function Skeleton({ className, circle = false }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "block animate-pulse bg-surface-container-high",
        circle ? "rounded-full" : "rounded-lg",
        className
      )}
    />
  );
}

/** Lista de tarjetas placeholder para búsquedas y cargas de listados. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Cargando" className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-card"
        >
          <Skeleton circle className="h-11 w-11" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
