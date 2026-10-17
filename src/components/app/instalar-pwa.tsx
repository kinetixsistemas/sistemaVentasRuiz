"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import {
  consumirPrompt,
  esIos,
  estaInstalada,
  getPrompt,
  subscribe,
} from "@/lib/pwa-install";

/**
 * Botón para instalar la app como PWA. En navegadores compatibles dispara el
 * prompt nativo; en iOS (Safari) muestra las instrucciones manuales.
 */
export function InstalarPwa() {
  const prompt = useSyncExternalStore(subscribe, getPrompt, () => null);
  const instalada = useSyncExternalStore(subscribe, estaInstalada, () => false);
  const ios = useSyncExternalStore(subscribe, esIos, () => false);
  const [instalando, setInstalando] = useState(false);

  async function instalar() {
    const evento = consumirPrompt();
    if (!evento) return;
    setInstalando(true);
    try {
      await evento.prompt();
      await evento.userChoice;
    } finally {
      setInstalando(false);
    }
  }

  return (
    <Card
      title="Aplicación"
      subtitle="Instala Kinetix POS en este dispositivo para usarla como app nativa."
    >
      {instalada ? (
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon name="verified" size={22} />
          </span>
          <div>
            <p className="text-label-lg text-on-surface">Ya está instalada</p>
            <p className="text-body-sm text-on-surface-variant">
              Estás usando la aplicación instalada en este dispositivo.
            </p>
          </div>
        </div>
      ) : prompt ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body-sm text-on-surface-variant">
            Instálala para abrirla desde tu pantalla de inicio, a pantalla completa y sin barra
            del navegador.
          </p>
          <Button icon="install_mobile" loading={instalando} onClick={instalar} className="shrink-0">
            Instalar aplicación
          </Button>
        </div>
      ) : ios ? (
        <div className="flex flex-col gap-2">
          <p className="text-body-sm text-on-surface-variant">
            En iPhone/iPad abre el menú <span className="font-semibold">Compartir</span> y elige
            <span className="font-semibold"> “Agregar a pantalla de inicio”.</span>
          </p>
        </div>
      ) : (
        <p className="text-body-sm text-on-surface-variant">
          Este navegador no ofrece la instalación automática. Si usas Chrome, Edge o Safari,
          vuelve a intentarlo desde el menú del navegador con “Instalar aplicación” o “Añadir a
          pantalla de inicio”.
        </p>
      )}
    </Card>
  );
}
