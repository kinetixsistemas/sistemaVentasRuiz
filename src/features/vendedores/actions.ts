"use server";

import { updateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { errorResult, fromZodError, type ActionResult } from "@/lib/result";
import { TAG_CLIENTES, TAG_COBRANZA, TAG_FACTURAS, TAG_VENDEDORES } from "@/lib/tags";
import {
  actualizarVendedorService,
  crearVendedorService,
  eliminarVendedorService,
  historialVendedorService,
  listarVendedoresService,
  pagarComisionVendedorService,
  resumenVendedoresService,
} from "./service";
import {
  actualizarVendedorSchema,
  crearVendedorSchema,
  historialVendedorSchema,
  pagarComisionVendedorSchema,
  resumenVendedoresSchema,
  type ComisionVendedor,
  type HistorialVendedorResult,
  type Vendedor,
  type VendedorResumen,
} from "./schemas";

export async function listarVendedores(): Promise<ActionResult<Vendedor[]>> {
  await requireUser();
  return listarVendedoresService();
}

export async function resumenVendedores(
  input?: unknown
): Promise<ActionResult<VendedorResumen[]>> {
  await requireUser();
  const parsed = resumenVendedoresSchema.safeParse(input ?? {});
  if (!parsed.success) return fromZodError<VendedorResumen[]>(parsed.error);
  return resumenVendedoresService(parsed.data);
}

export async function historialVendedor(
  input: unknown
): Promise<ActionResult<HistorialVendedorResult>> {
  await requireUser();
  const parsed = historialVendedorSchema.safeParse(input ?? {});
  if (!parsed.success) return fromZodError<HistorialVendedorResult>(parsed.error);
  return historialVendedorService(parsed.data);
}

export async function pagarComisionVendedor(
  input: unknown
): Promise<ActionResult<ComisionVendedor>> {
  await requireUser();
  const parsed = pagarComisionVendedorSchema.safeParse(input);
  if (!parsed.success) return fromZodError<ComisionVendedor>(parsed.error);

  const result = await pagarComisionVendedorService(parsed.data);
  if (result.ok) updateTag(TAG_VENDEDORES);
  return result;
}

export async function crearVendedor(input: unknown): Promise<ActionResult<Vendedor>> {
  await requireUser();
  const parsed = crearVendedorSchema.safeParse(input);
  if (!parsed.success) return fromZodError<Vendedor>(parsed.error);

  const result = await crearVendedorService(parsed.data);
  if (result.ok) updateTag(TAG_VENDEDORES);
  return result;
}

export async function actualizarVendedor(input: unknown): Promise<ActionResult<Vendedor>> {
  await requireUser();
  const parsed = actualizarVendedorSchema.safeParse(input);
  if (!parsed.success) return fromZodError<Vendedor>(parsed.error);

  const result = await actualizarVendedorService(parsed.data);
  if (result.ok) {
    updateTag(TAG_VENDEDORES);
    updateTag(TAG_CLIENTES);
    updateTag(TAG_FACTURAS);
    updateTag(TAG_COBRANZA);
  }
  return result;
}

export async function eliminarVendedor(vendedorId: unknown): Promise<ActionResult<null>> {
  await requireUser();
  if (typeof vendedorId !== "string" || !vendedorId.trim()) {
    return errorResult("VALIDATION", "Falta el identificador del vendedor.");
  }

  const result = await eliminarVendedorService(vendedorId.trim());
  if (result.ok) {
    updateTag(TAG_VENDEDORES);
    updateTag(TAG_CLIENTES);
    updateTag(TAG_FACTURAS);
    updateTag(TAG_COBRANZA);
  }
  return result;
}
