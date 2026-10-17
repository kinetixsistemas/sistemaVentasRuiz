import type { CookieOptions } from "@supabase/ssr";

/**
 * Opciones de cookie para la sesión de Supabase.
 *
 * Objetivo: mantener la sesión iniciada por más tiempo (evitar logins
 * constantes en el uso diario desde el móvil) sin relajar la seguridad.
 * - `maxAge`: 30 días (alineado con la expiración del refresh token).
 * - `sameSite: "lax"`: la navegación normal ya va a sitios externos solo por
 *   enlaces GET, así que Lax es suficiente y compatible con SSR.
 * - `secure`: solo en producción, para no romper el desarrollo en http local.
 * - `path: "/"`: la sesión aplica a toda la app.
 */
export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  maxAge: 60 * 60 * 24 * 30,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
