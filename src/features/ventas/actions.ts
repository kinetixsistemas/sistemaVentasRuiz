"use server";

import { updateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { fromZodError, type ActionResult } from "@/lib/result";
import { TAG_CLIENTES, TAG_COBRANZA, TAG_FACTURAS, TAG_PRODUCTOS } from "@/lib/tags";
import { crearFacturaService, listarFacturasService, obtenerFacturaDetalleService, resumenCarteraService, resumenVentasPeriodoService } from "./service";
import {
  crearFacturaSchema,
  listarFacturasSchema,
  obtenerFacturaSchema,
  resumenVentasSchema,
  type FacturaConSaldo,
  type FacturaDetalle,
  type ListarFacturasResult,
  type ResumenCartera,
  type ResumenVentas,
} from "./schemas";

export async function crearFactura(
  input: unknown
): Promise<ActionResult<{ factura: FacturaConSaldo }>> {
  await requireUser();
  const parsed = crearFacturaSchema.safeParse(input);
  if (!parsed.success) return fromZodError<{ factura: FacturaConSaldo }>(parsed.error);

  const result = await crearFacturaService(parsed.data);
  if (result.ok) {
    // La factura nueva afecta ventas, stock, cliente y estado de cuenta del cliente.
    updateTag(TAG_FACTURAS);
    updateTag(TAG_PRODUCTOS);
    updateTag(TAG_COBRANZA);
    updateTag(TAG_CLIENTES);
  }
  return result;
}

export async function listarFacturas(input?: unknown): Promise<ActionResult<ListarFacturasResult>> {
  await requireUser();
  const parsed = listarFacturasSchema.safeParse(input ?? {});
  if (!parsed.success) return fromZodError<ListarFacturasResult>(parsed.error);
  return listarFacturasService(parsed.data);
}

/** KPIs del panel inicial; el agregado se calcula en la BD (RPC `resumen_cartera`). */
export async function resumenCartera(): Promise<ActionResult<ResumenCartera>> {
  await requireUser();
  return resumenCarteraService();
}

/** KPIs de ventas de un período (mes); el agregado se calcula en la BD. */
export async function resumenVentas(input: unknown): Promise<ActionResult<ResumenVentas>> {
  await requireUser();
  const parsed = resumenVentasSchema.safeParse(input);
  if (!parsed.success) return fromZodError<ResumenVentas>(parsed.error);
  return resumenVentasPeriodoService(parsed.data);
}

export async function obtenerFactura(input: unknown): Promise<ActionResult<FacturaDetalle>> {
  await requireUser();
  const parsed = obtenerFacturaSchema.safeParse(input);
  if (!parsed.success) return fromZodError<FacturaDetalle>(parsed.error);
  return obtenerFacturaDetalleService(parsed.data.id);
}