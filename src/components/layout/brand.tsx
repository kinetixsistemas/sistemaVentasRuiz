import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";

/** Nombre de respaldo cuando la empresa aún no tiene datos configurados. */
export const NOMBRE_APP = "Sistemas Kinetix";

export function Brand({
  nombre,
  logoUrl,
  inverse = false,
  className,
}: {
  /** Nombre comercial de la empresa (tabla `empresa`). */
  nombre?: string | null;
  /** URL pública del logotipo de la empresa. */
  logoUrl?: string | null;
  inverse?: boolean;
  className?: string;
}) {
  const titulo = nombre?.trim() || NOMBRE_APP;

  return (
    <Link href="/" className={cn("flex items-center gap-3", className)} aria-label={titulo}>
      {logoUrl ? (
        // Logotipo ya optimizado servido desde Supabase Storage (images.unoptimized).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="h-9 w-9 shrink-0 rounded-xl bg-surface-container object-contain"
        />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
          <Icon name="storefront" size={20} />
        </span>
      )}
      <span className="flex flex-col leading-tight">
        <span
          className={cn(
            "text-headline-sm font-bold",
            inverse ? "text-on-primary" : "text-on-surface"
          )}
        >
          {titulo}
        </span>
        <span
          className={cn(
            "text-label-sm",
            inverse ? "text-on-primary/70" : "text-on-surface-variant"
          )}
        >
          Gestión Comercial &amp; PWA
        </span>
      </span>
    </Link>
  );
}
