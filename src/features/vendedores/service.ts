import { errorResult, fromPostgresError, okResult, type ActionResult } from "@/lib/result";
import {
  actualizarVendedorRepo,
  contarUsoVendedorRepo,
  crearVendedorRepo,
  eliminarVendedorRepo,
  historialVendedorRepo,
  listarVendedoresRepo,
  pagarComisionVendedorRepo,
  resumenVendedoresRepo,
} from "./repository";
import type {
  ActualizarVendedorInput,
  ComisionVendedor,
  CrearVendedorInput,
  HistorialVendedorInput,
  HistorialVendedorResult,
  PagarComisionVendedorInput,
  ResumenVendedoresInput,
  Vendedor,
  VendedorResumen,
} from "./schemas";

export async function listarVendedoresService(): Promise<ActionResult<Vendedor[]>> {
  try {
    return okResult(await listarVendedoresRepo());
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function resumenVendedoresService(
  input: ResumenVendedoresInput
): Promise<ActionResult<VendedorResumen[]>> {
  try {
    return okResult(await resumenVendedoresRepo(input.desde, input.hasta));
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function historialVendedorService(
  input: HistorialVendedorInput
): Promise<ActionResult<HistorialVendedorResult>> {
  try {
    return okResult(
      await historialVendedorRepo(input.vendedor_id, input.pagina, input.porPagina)
    );
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function pagarComisionVendedorService(
  input: PagarComisionVendedorInput
): Promise<ActionResult<ComisionVendedor>> {
  try {
    return okResult(await pagarComisionVendedorRepo(input));
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function crearVendedorService(
  input: CrearVendedorInput
): Promise<ActionResult<Vendedor>> {
  try {
    return okResult(await crearVendedorRepo(input));
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function actualizarVendedorService(
  input: ActualizarVendedorInput
): Promise<ActionResult<Vendedor>> {
  try {
    return okResult(await actualizarVendedorRepo(input));
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function eliminarVendedorService(id: string): Promise<ActionResult<null>> {
  try {
    const uso = await contarUsoVendedorRepo(id);
    if (uso.clientes > 0 || uso.facturas > 0) {
      return errorResult(
        "VENDEDOR_CON_DATOS",
        "No se puede eliminar: el vendedor tiene clientes o facturas asociadas. Puedes desactivarlo."
      );
    }
    await eliminarVendedorRepo(id);
    return okResult(null);
  } catch (error) {
    return fromPostgresError(error);
  }
}
