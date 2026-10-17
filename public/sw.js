/*
 * Service worker minimalista.
 *
 * Reglas IMPORTANTES (por qué el service worker anterior rompía Next.js):
 * - NUNCA se cachean ni interceptan respuestas de navegación/HTML ni payloads
 *   RSC (react-server-dom). Cachear esos payloads provoca errores como
 *   "chunk.reason.enqueueModel is not a function" o timestamps negativos de
 *   Performance al reproducir datos de una build anterior.
 * - Solo se cachean assets inmutables de `/_next/static/` (cache-first).
 * - Ante un fallo de red en una navegación se sirve la página /offline
 *   precacheada. Si tampoco existe, SIEMPRE se devuelve una Response válida:
 *   `respondWith` con `undefined` lanza "Failed to convert value to 'Response'".
 */
const CACHE_SHELL = "kinetix-shell-v1";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  "/",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icon.svg",
  "/kinetixLogo.webp",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
];
const STATIC_PREFIX = "/_next/static/";

function respuestaSinConexion() {
  return new Response("Sin conexión. Abre la app de nuevo cuando recuperes internet.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

self.addEventListener("install", (event) => {
  // Se precachea cada URL por separado: si una falla, la instalación no se aborta.
  event.waitUntil(
    caches
      .open(CACHE_SHELL)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((url) => cache.add(url).catch(() => undefined))
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_SHELL).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Solo se atiende el mismo origen y se deja pasar la API sin tocar.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navegaciones: red primero, /offline solo si falla. No se cachea el HTML.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL);
        return offline ?? respuestaSinConexion();
      })
    );
    return;
  }

  // Assets inmutables del build de Next: cache-first.
  if (url.pathname.startsWith(STATIC_PREFIX)) {
    event.respondWith(
      caches.match(request).then((enCache) => {
        if (enCache) return enCache;
        return fetch(request)
          .then((respuesta) => {
            if (respuesta.ok) {
              const copia = respuesta.clone();
              caches.open(CACHE_SHELL).then((cache) => cache.put(request, copia));
            }
            return respuesta;
          })
          .catch(() => respuestaSinConexion());
      })
    );
    return;
  }

  // Cualquier otra petición GET la maneja el navegador (sin cachear).
});
