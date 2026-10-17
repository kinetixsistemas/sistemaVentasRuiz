"use client";

import { useEffect } from "react";
import { initPwaInstall } from "@/lib/pwa-install";

/** Registra el service worker para habilitar la apertura offline del shell. */
export function PwaRegister() {
  useEffect(() => {
    // Captura temprana del prompt de instalación (ver `lib/pwa-install`).
    const limpiarInstall = initPwaInstall();

    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return limpiarInstall;
    }

    const soportado =
      window.location.protocol === "https:" || window.location.hostname === "localhost";
    if (!soportado) return limpiarInstall;
    // En desarrollo se eliminan los service workers y cachés previos.
    // Un SW antiguo que cachea payloads RSC rompe Fast Refresh y termina
    // mostrando la página de error; además interceptaba /sw.js, por lo que
    // nunca se actualizaba. Aquí se fuerza su retirada.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registros) => Promise.all(registros.map((registro) => registro.unregister())))
        .catch(() => undefined);

      if (typeof caches !== "undefined") {
        void caches
          .keys()
          .then((claves) => Promise.all(claves.map((clave) => caches.delete(clave))))
          .catch(() => undefined);
      }
      return limpiarInstall;
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // La falta de soporte o un registro fallido no debe romper la app.
    });
    return limpiarInstall;
  }, []);

  return null;
}
