"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-surface-container-lowest px-4 py-16 text-center shadow-card">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-error-container text-error">
        <Icon name="error" size={30} strokeWidth={1.8} />
      </span>
      <h1 className="text-headline-md text-on-surface">Algo salió mal</h1>
      <p className="max-w-sm text-body-md text-on-surface-variant">
        No se pudo cargar esta sección. Inténtalo de nuevo o vuelve más tarde.
      </p>
      <Button onClick={reset} icon="progress_activity" className="mt-2">
        Reintentar
      </Button>
    </div>
  );
}