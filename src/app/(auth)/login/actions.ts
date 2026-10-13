"use server";

import { login as iniciarSesion } from "@/lib/auth";
import type { ActionResult } from "@/lib/result";

// Puente "use server" sobre @/lib/auth: permite invocar `login` desde el
// LoginForm (client component) sin exponer el módulo en el bundle del cliente.
export async function login(input: {
  email: string;
  password: string;
}): Promise<ActionResult<null>> {
  return iniciarSesion(input);
}