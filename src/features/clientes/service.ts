import {
  actualizarClienteRepo,
  crearClienteRepo,
  eliminarClienteRepo,
  listarClientesRepo,
  obtenerClienteRepo,
  tieneFacturasRepo,
} from "./repository";
import {
  errorResult,
  esErrorNoEncontrado,
  fromPostgresError,
  okResult,
  type ActionResult,
} from "@/lib/result";
import type {
  ActualizarClienteInput,
  Cliente,
  CrearClienteInput,
  ListarClientesInput,
  ListarClientesResult,
} from "./schemas";

export async function crearClienteService(
  input: CrearClienteInput
): Promise<ActionResult<Cliente>> {
  try {
    const cliente = await crearClienteRepo(input);
    return okResult(cliente);
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function actualizarClienteService(
  input: ActualizarClienteInput
): Promise<ActionResult<Cliente>> {
  try {
    const cliente = await actualizarClienteRepo(input);
    return okResult(cliente);
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function eliminarClienteService(id: string): Promise<ActionResult<null>> {
  try {
    if (await tieneFacturasRepo(id)) {
      return errorResult(
        "CLIENTE_CON_FACTURAS",
        "No se puede eliminar: el cliente tiene facturas asociadas."
      );
    }
    await eliminarClienteRepo(id);
    return okResult(null);
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function obtenerClienteService(id: string): Promise<ActionResult<Cliente>> {
  try {
    const cliente = await obtenerClienteRepo(id);
    return okResult(cliente);
  } catch (error) {
    if (esErrorNoEncontrado(error)) {
      return errorResult("CLIENTE_NOT_FOUND", "El cliente no existe.");
    }
    return fromPostgresError(error);
  }
}

export async function listarClientesService(
  input: ListarClientesInput
): Promise<ActionResult<ListarClientesResult>> {
  try {
    const data = await listarClientesRepo(input.busqueda, input.pagina, input.porPagina);
    return okResult(data);
  } catch (error) {
    return fromPostgresError(error);
  }
}