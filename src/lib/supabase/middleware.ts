import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

/**
 * Refresca la sesión en cada petición y protege las rutas privadas.
 * Se invoca desde `src/proxy.ts` (Next.js 16 renombró `middleware` → `proxy`).
 *
 * Reglas:
 * - Usuario autenticado → /login redirige al inicio.
 * - Sin usuario → cualquier ruta privada redirige a /login.
 * - Sin usuario → las rutas /api/* responden 401 (no HTML de login).
 * - /login siempre es público.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { url, key } = getSupabaseEnv();
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // `getClaims()` verifica el JWT localmente (JWKS cacheado) y refresca el token
  // si está por expirar, evitando el viaje de red a Auth en cada petición.
  // Contrapartida: no detecta revocación/eliminación del usuario en el servidor
  // de inmediato (el token sigue válido hasta expirar ~1h). Si se necesita
  // revocación inmediata, volver a `getUser()`.
  const { data, error } = await supabase.auth.getClaims();
  const user = !error && data?.claims ? data.claims : null;

  const pathname = request.nextUrl.pathname;

  if (user && pathname === "/login") {
    const inicioUrl = request.nextUrl.clone();
    inicioUrl.pathname = "/";
    return NextResponse.redirect(inicioUrl);
  }

  if (!user && pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!user && pathname !== "/login") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}