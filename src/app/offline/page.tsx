import type { Metadata } from "next";
import { Icon } from "@/components/ui/icon";
import { RetryButton } from "@/components/app/retry-button";

export const metadata: Metadata = {
  title: "Sin conexión",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name="error" size={32} />
      </span>
      <div>
        <h1 className="text-headline-md text-on-surface">Sin conexión</h1>
        <p className="mt-1 max-w-xs text-body-md leading-relaxed text-on-surface-variant">
          No hay conexión a internet. Vuelve a conectarte y abre la aplicación de nuevo.
        </p>
      </div>
      <RetryButton />
    </div>
  );
}