"use server";

import { logout as cerrarSesion } from "@/lib/auth";

// Puente "use server" sobre @/lib/auth para usarlo desde componentes client.
export async function logout(): Promise<void> {
  await cerrarSesion();
}