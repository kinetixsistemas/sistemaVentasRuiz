/**
 * Estado global mínimo para el flujo de instalación de la PWA.
 *
 * `beforeinstallprompt` puede dispararse antes de que se monte el botón de
 * instalación (p. ej. mientras el usuario está en otra pantalla), por lo que el
 * evento se captura una sola vez al arrancar la app (`PwaRegister`) y se guarda
 * aquí. El botón se suscribe a este store con `useSyncExternalStore`, lo que
 * evita llamar a `setState` dentro de un efecto.
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let instalada = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Registra los listeners globales. Devuelve la función de limpieza. */
export function initPwaInstall(): () => void {
  if (typeof window === "undefined") return () => {};

  const onPrompt = (evento: Event) => {
    evento.preventDefault();
    deferred = evento as BeforeInstallPromptEvent;
    emit();
  };
  const onInstalled = () => {
    instalada = true;
    deferred = null;
    emit();
  };

  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);

  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** ¿La app corre ya como PWA instalada (standalone)? */
export function estaEnModoApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** ¿El dispositivo ya tiene la app instalada? */
export function estaInstalada(): boolean {
  return instalada || estaEnModoApp();
}

/** Prompt de instalación pendiente, o `null` si el navegador aún no lo ofrece. */
export function getPrompt(): BeforeInstallPromptEvent | null {
  return deferred;
}

/** Consume y limpia el prompt para disparar la instalación una sola vez. */
export function consumirPrompt(): BeforeInstallPromptEvent | null {
  const actual = deferred;
  deferred = null;
  emit();
  return actual;
}

/**
 * ¿Es iOS/iPadOS? Safari no implementa `beforeinstallprompt`: la instalación es
 * manual desde el menú Compartir.
 */
export function esIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const esIphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const esIpadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return esIphone || esIpadOs;
}
