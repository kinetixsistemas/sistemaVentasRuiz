"use server";

import { updateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { fromZodError, type ActionResult } from "@/lib/result";
import { TAG_USUARIOS } from "@/lib/tags";
import {
  actualizarMiPerfilService,
  crearUsuarioService,
  listarUsuariosService,
} from "./service";
import { actualizarPerfilSchema, crearUsuarioSchema, type Perfil } from "./schemas";

export async function crearUsuario(input: unknown): Promise<ActionResult<Perfil>> {
  await requireUser();
  const parsed = crearUsuarioSchema.safeParse(input);
  if (!parsed.success) return fromZodError<Perfil>(parsed.error);

  const result = await crearUsuarioService(parsed.data);
  if (result.ok) updateTag(TAG_USUARIOS);
  return result;
}

export async function actualizarMiPerfil(input: unknown): Promise<ActionResult<Perfil>> {
  const user = await requireUser();
  const parsed = actualizarPerfilSchema.safeParse(input);
  if (!parsed.success) return fromZodError<Perfil>(parsed.error);

  const result = await actualizarMiPerfilService(user.id, parsed.data);
  if (result.ok) updateTag(TAG_USUARIOS);
  return result;
}

export async function listarUsuarios(): Promise<ActionResult<Perfil[]>> {
  await requireUser();
  return listarUsuariosService();
}
