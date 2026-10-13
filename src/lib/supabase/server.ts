import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Lee y escribe la sesión desde las cookies de la petición.
 *
 * Se memoriza con `cache()` de React: dentro de una misma petición de render
 * (layout + páginas + acciones invocadas) se reutiliza una sola instancia en
 * lugar de crear un cliente nuevo por llamada.
 *
 * Caché: los datos financieros y de stock NO deben cachearse; este cliente se
 * usa siempre dentro de componentes/rutas dinámicas o acciones (ej. `dynamic`).
 */
export const createSupabaseServerClient = cache(
  async (): Promise<SupabaseClient<Database>> => {
    const cookieStore = await cookies();
    const { url, key } = getSupabaseEnv();

    return createServerClient<Database>(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Si se llama desde un Server Component no se pueden escribir cookies;
            // el proxy (src/proxy.ts) se encarga de refrescar la sesión en la petición.
          }
        },
      },
    });
  }
);