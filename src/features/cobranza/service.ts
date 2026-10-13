import {
  listarSaldoPendienteRepo,
  obtenerCobroPorIdRepo,
  procesarPagoRepo,
  ultimosPagosRepo,
} from "./repository";
import { fromPostgresError, okResult, type ActionResult } from "@/lib/result";
import type {
  ListarSaldoPendienteInput,
  ListarSaldoPendienteResult,
  PagoRegistrado,
  ProcesarPagoInput,
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