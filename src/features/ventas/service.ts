import {
  crearFacturaRepo,
  listarFacturasRepo,
  obtenerFacturaConSaldoRepo,
  obtenerFacturaDetalleRepo,
  resumenCarteraRepo,
  resumenVentasPeriodoRepo,
} from "./repository";
import {
  errorResult,
  esErrorNoEncontrado,
  fromPostgresError,
  okResult,
  type ActionResult,
} from "@/lib/result";
import type {
  CrearFacturaInput,
  FacturaConSaldo,
  FacturaDetalle,
  ListarFacturasInput,
  ListarFacturasResult,
  ResumenCartera,
  ResumenVentas,
  ResumenVentasInput,
} from "./schemas";

/** Crea la factura de forma atómica en la BD (valida stock y calcula total). */
export async function crearFacturaService(
  input: CrearFacturaInput
): Promise<ActionResult<{ factura: FacturaConSaldo }>> {
  try {
    const facturaId = await crearFacturaRepo(input);
    // Se devuelve la factura creada para reflejarla en la lista sin recargar.
    const factura = await obtenerFacturaConSaldoRepo(facturaId);
    return okResult({ factura });
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function listarFacturasService(
  input: ListarFacturasInput
): Promise<ActionResult<ListarFacturasResult>> {
  try {
    const resultado = await listarFacturasRepo(input);
    return okResult(resultado);
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function resumenCarteraService(): Promise<ActionResult<ResumenCartera>> {
  try {
    const resumen = await resumenCarteraRepo();
    return okResult(resumen);
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function resumenVentasPeriodoService(
  input: ResumenVentasInput
): Promise<ActionResult<ResumenVentas>> {
  try {
    const resumen = await resumenVentasPeriodoRepo(input);
    return okResult(resumen);
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function obtenerFacturaDetalleService(
  id: string
): Promise<ActionResult<FacturaDetalle>> {
  try {
    const detalle = await obtenerFacturaDetalleRepo(id);
    return okResult(detalle);
  } catch (error) {
    if (esErrorNoEncontrado(error)) {
      return errorResult("FACTURA_NOT_FOUND", "La factura no existe.");
    }
    return fromPostgresError(error);
  }
}