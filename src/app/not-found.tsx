import type { Metadata } from "next";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background p-6 text-center">
      <Brand />
      <div className="flex items-baseline gap-2">
        <span className="text-numeric-currency text-primary">404</span>
        <Icon name="signpost" size={26} className="text-on-surface-variant" />
      </div>
      <h1 className="text-headline-lg text-on-surface">Página no encontrada</h1>
      <p className="max-w-sm text-body-md text-on-surface-variant">
        La ruta que buscas no existe o fue movida. Revisa la dirección o vuelve al inicio.
      </p>
      <Button href="/" icon="home" size="lg" className="mt-2">
        Volver al inicio
      </Button>
    </main>
  );
}