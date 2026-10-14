"use server";

import { updateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { fromZodError, type ActionResult } from "@/lib/result";
import { TAG_CLIENTES, TAG_COBRANZA, TAG_FACTURAS } from "@/lib/tags";
import {
  listarSaldoPendienteService,
  procesarPagoService,
  ultimosPagosService,
} from "./service";
import {
  estadoCuentaSchema,
  listarSaldoPendienteSchema,
  procesarPagoSchema,
  ultimosPagosSchema,
  type ListarSaldoPendienteResult,
  type PagoRegistrado,
  type UltimoCobro,
} from "./schemas";
import { obtenerEstadoCuentaService, type EstadoCuenta } from "./estado-cuenta";

export async function procesarPago(input: unknown): Promise<ActionResult<PagoRegistrado>> {
  await requireUser();
  const parsed = procesarPagoSchema.safeParse(input);
  if (!parsed.success) return fromZodError<PagoRegistrado>(parsed.error);

  const result = await procesarPagoService(parsed.data);
  if (result.ok) {
    // El pago afecta el saldo de la factura y el estado de cuenta del cliente.
    updateTag(TAG_COBRANZA);
    updateTag(TAG_FACTURAS);
    updateTag(TAG_CLIENTES);
  }
  return result;
}

export async function listarSaldoPendiente(
  input?: unknown
): Promise<ActionResult<ListarSaldoPendienteResult>> {
  await requireUser();
  const parsed = listarSaldoPendienteSchema.safeParse(input ?? {});
  if (!parsed.success) return fromZodError<ListarSaldoPendienteResult>(parsed.error);
  return listarSaldoPendienteService(parsed.data);
}

export async function ultimosPagos(input?: unknown): Promise<ActionResult<UltimoCobro[]>> {
  await requireUser();
  const parsed = ultimosPagosSchema.safeParse(input ?? {});
  if (!parsed.success) return fromZodError<UltimoCobro[]>(parsed.error);
  return ultimosPagosService(parsed.data.limite);
}

/** Estado de cuenta de un cliente (historial), con rango de emisión opcional. */
export async function obtenerEstadoCuenta(input: unknown): Promise<ActionResult<EstadoCuenta>> {
  await requireUser();
  const parsed = estadoCuentaSchema.safeParse(input);
  if (!parsed.success) return fromZodError<EstadoCuenta>(parsed.error);
  const { cliente_id, desde, hasta } = parsed.data;
  return obtenerEstadoCuentaService(cliente_id, desde && hasta ? { desde, hasta } : undefined);
}