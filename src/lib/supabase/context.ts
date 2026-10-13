import {
  createAdminClient,
  createContextClient,
  resolveEnv,
  verifyCredentials,
} from "@supabase/server/core";
import type { AuthModeWithKey, SupabaseContext } from "@supabase/server";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";
import { createSupabaseServerClient } from "./server";

/**
 * Adaptador que compone `@supabase/ssr` (sesión en cookies) con los primitivos
 * de `@supabase/server` (verificación de JWT contra JWKS + clientes tipados).
 *
 * `@supabase/ssr` mantiene la rotación del token en el proxy; aquí se reutiliza
 * su sesión ya refrescada para verificar criptográficamente el access token y
 * devolver un contexto equivalente al de `createSupabaseContext` de
 * `@supabase/server`.
 */
export async function createSupabaseContext(
  options: { auth?: AuthModeWithKey | AuthModeWithKey[] } = { auth: "user" }
): Promise<
  | { data: SupabaseContext<Database>; error: null }
  | { data: null; error: Error }
> {
  const { url, key } = getSupabaseEnv();

  const resolved = resolveEnv({
    url,
    publishableKeys: { default: key },
  });

  if (resolved.error) {
    return { data: null, error: resolved.error };
  }

  const env = resolved.data;

  const ssrClient = await createSupabaseServerClient();
  const {
    data: { session },
  } = await ssrClient.auth.getSession();
  const token = session?.access_token ?? null;

  const auth = await verifyCredentials(
    { token, apikey: null },
    { auth: options.auth ?? "user", env }
  );

  if (auth.error) {
    return { data: null, error: auth.error };
  }

  const supabase = createContextClient<Database>({
    auth: { token: auth.data.token },
    env,
  });
  const supabaseAdmin = createAdminClient<Database>({ env });

  return {
    data: {
      supabase,
      supabaseAdmin,
      userClaims: auth.data.userClaims,
      jwtClaims: auth.data.jwtClaims,
      authMode: auth.data.authMode,
    },
    error: null,
  };
}
