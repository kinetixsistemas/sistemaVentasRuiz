import type { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Proxy (antiguo middleware) de Next.js 16: se ejecuta antes de cada petición.
 * Refresca la sesión y redirige a /login si no hay usuario autenticado.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Todo menos estáticos, imágenes, favicon, manifest y archivos SEO.
    // /login se maneja dentro de updateSession como ruta pública.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|robots.txt|sitemap.xml|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};