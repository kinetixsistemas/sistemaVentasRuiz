import { z } from "zod";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  errorResult,
  fromZodError,
  okResult,
  type ActionResult,
} from "@/lib/result";

const loginSchema = z.object({
  email: z.email("El correo debe tener un formato válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export type UsuarioSesion = { id: string; email?: string };

/**
 * Devuelve el usuario autenticado o `null`.
 *
 * Usa `auth.getClaims()`: verifica la firma del JWT localmente con el JWKS
 * cacheado (el proyecto firma con clave asimétrica ES256), evitando el viaje de
 * red a Supabase Auth que hacía `getUser()` en cada render. Nunca `getSession()`.
 *
 * La revocación inmediata de sesiones la sigue garantizando el proxy
 * (`src/lib/supabase/middleware.ts`), que valida con `getUser()` en cada
 * petición; aquí basta con verificar el token.
 *
 * Memorizado con `cache()`: en una misma petición de render, el layout, la
 * página y las acciones invocadas comparten una sola verificación.
 */
export const getCurrentUser = cache(async (): Promise<UsuarioSesion | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  const id = data?.claims?.sub;
  if (error || !id) return null;

  const email = data?.claims?.email;
  return { id, email: typeof email === "string" ? email : undefined };
});

/**
 * Exige sesión activa. Redirige a /login si no hay usuario autenticado.
 * Usar en Server Actions; los Route Handlers prefieren `getCurrentUser()`.
 */
export async function requireUser(): Promise<UsuarioSesion> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Inicia sesión con correo y contraseña (Supabase Auth).
 * La sesión queda en cookies gestionadas por @supabase/ssr.
 */
export async function login(input: {
  email: string;
  password: string;
}): Promise<ActionResult<null>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "invalid_credentials") {
      return errorResult("AUTH_INVALID_CREDENTIALS", "Correo o contraseña incorrectos");
    }
    return errorResult("AUTH_ERROR", "No se pudo iniciar sesión. Intente de nuevo.");
  }

  return okResult(null);
}

/** Cierra la sesión y limpia las cookies del navegador. */
export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}