// ============================================================================
// Cliente ADMIN de Supabase con la clave `service_role`.
//
// SOLO SERVIDOR. Nunca debe importarse desde código de cliente (navegador).
// Esta clave omite RLS y da acceso total a la base de datos y a Auth.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL o " +
        "SUPABASE_SERVICE_ROLE_KEY. Esta clave es solo para el servidor."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
