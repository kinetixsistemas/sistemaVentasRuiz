import {
  listarSaldoPendienteRepo,
  obtenerCobroPorIdRepo,
  obtenerSaldoPendienteRepo,
  procesarPagoAsignadoRepo,
  procesarPagoRepo,
  ultimosPagosRepo,
} from "./repository";
import { fromPostgresError, okResult, type ActionResult } from "@/lib/result";
import type {
  ListarSaldoPendienteInput,
  ListarSaldoPendienteResult,
  PagoAsignadoRegistrado,
  PagoRegistrado,
  ProcesarPagoAsignadoInput,
  ProcesarPagoInput,
  SaldoPendiente,
  UltimoCobro,
} from "./schemas";

/** Registra el pago y devuelve el cobro creado y el nuevo saldo de la factura. */
export async function procesarPagoService(
  input: ProcesarPagoInput
): Promise<ActionResult<PagoRegistrado>> {
  try {
    const resultado = await procesarPagoRepo(input);
    const pago = await obtenerCobroPorIdRepo(resultado.pago_id);
    return okResult({
      pago,
      factura_id: resultado.factura_id,
      monto_usd: resultado.monto_usd,
      saldo_usd: resultado.saldo_usd,
    });
  } catch (error) {
    return fromPostgresError(error);
  }
}

/** Registra un pago repartido entre varias facturas y devuelve los cobros creados. */
export async function procesarPagoAsignadoService(
  input: ProcesarPagoAsignadoInput
): Promise<ActionResult<PagoAsignadoRegistrado>> {
  try {
    const resultado = await procesarPagoAsignadoRepo(input);
    const pagos = await Promise.all(
      resultado.pagos.map(async (fila) => ({
        pago: await obtenerCobroPorIdRepo(fila.pago_id),
        factura_id: fila.factura_id,
        monto_usd: fila.monto_usd,
        saldo_usd: fila.saldo_usd,
      }))
    );
    return okResult({ pagos, total_usd: resultado.total_usd });
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function listarSaldoPendienteService(
  input: ListarSaldoPendienteInput
): Promise<ActionResult<ListarSaldoPendienteResult>> {
  try {
    const data = await listarSaldoPendienteRepo(input);
    return okResult(data);
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function ultimosPagosService(limite: number): Promise<ActionResult<UltimoCobro[]>> {
  try {
    const pagos = await ultimosPagosRepo(limite);
    return okResult(pagos);
  } catch (error) {
    return fromPostgresError(error);
  }
}

/** Una factura con saldo por su id (deep-link de cobro). */
export async function obtenerSaldoPendienteService(
  facturaId: string
): Promise<ActionResult<SaldoPendiente | null>> {
  try {
    const saldo = await obtenerSaldoPendienteRepo(facturaId);
    return okResult(saldo);
  } catch (error) {
    return fromPostgresError(error);
  }
}