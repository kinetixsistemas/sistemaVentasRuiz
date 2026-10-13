"use server";

import { updateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { errorResult, fromZodError, type ActionResult } from "@/lib/result";
import { TAG_EMPRESA } from "@/lib/tags";
import {
  actualizarEmpresaService,
  obtenerEmpresaService,
  subirLogoEmpresaService,
} from "./service";
import { actualizarEmpresaSchema, type Empresa } from "./schemas";

export async function obtenerEmpresa(): Promise<ActionResult<Empresa>> {
  await requireUser();
  return obtenerEmpresaService();
}

export async function actualizarEmpresa(input: unknown): Promise<ActionResult<Empresa>> {
  await requireUser();
  const parsed = actualizarEmpresaSchema.safeParse(input);
  if (!parsed.success) return fromZodError<Empresa>(parsed.error);

  const result = await actualizarEmpresaService(parsed.data);
  if (result.ok) updateTag(TAG_EMPRESA);
  return result;
}

/**
 * Sube el logotipo de la empresa a Supabase Storage.
 * Espera un FormData con `logo` (archivo de imagen ya comprimido).
 */
export async function subirLogoEmpresa(formData: FormData): Promise<ActionResult<Empresa>> {
  await requireUser();

  const archivo = formData.get("logo") ?? formData.get("archivo");
  if (!(archivo instanceof File)) {
    return errorResult("LOGO_INVALIDO", "Debe seleccionar un archivo de imagen.");
  }

  const result = await subirLogoEmpresaService({ archivo });
  if (result.ok) updateTag(TAG_EMPRESA);
  return result;
}
