import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

let browserClient: SupabaseClient<Database> | null = null;

/**
 * Cliente de Supabase para el navegador (client components), cuando sea necesario.
 * La sesión vive en cookies (no en localStorage), por lo que el servidor también
 * puede leerla.
 */
export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!browserClient) {
    const { url, key } = getSupabaseEnv();
    browserClient = createBrowserClient<Database>(url, key);
  }
  return browserClient;
}