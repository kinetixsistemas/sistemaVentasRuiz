/**
 * Etiquetas de revalidación de caché de Next.js.
 *
 * Los datos financieros y de stock NO se cachean (ver AGENTS.md), pero estas
 * etiquetas se pasan a `updateTag` en las Server Actions tras cada mutación.
 * En Next.js, llamar a `updateTag` dentro de una Server Action fuerza el
 * re-render de la ruta actual en la misma respuesta (read-your-own-writes), de
 * modo que los listados se refrescan al instante. Además quedan listas para
 * invalidar datos etiquetados si algún día se cachean.
 *
 * `TAG_EMPRESA` sí invalida una caché real: la marca de la empresa se guarda
 * con `unstable_cache` en `features/empresa/repository.ts`.
 */
export const TAG_PRODUCTOS = "productos";
export const TAG_CLIENTES = "clientes";
export const TAG_FACTURAS = "facturas";
export const TAG_COBRANZA = "cobranza";
export const TAG_EMPRESA = "empresa";
export const TAG_USUARIOS = "usuarios";