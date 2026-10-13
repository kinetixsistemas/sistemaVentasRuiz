import {
  actualizarFotoRepo,
  crearProductoRepo,
  eliminarFotoRepo,
  eliminarProductoRepo,
  listarProductosRepo,
  listarStockBajoRepo,
  obtenerProductoRepo,
  obtenerPublicUrlRepo,
  subirFotoRepo,
  tieneMovimientosRepo,
  actualizarProductoRepo,
} from "./repository";
import {
  errorResult,
  esErrorNoEncontrado,
  fromPostgresError,
  okResult,
  type ActionResult,
} from "@/lib/result";
import { round2 } from "@/lib/currency";
import type {
  ActualizarProductoInput,
  CrearProductoInput,
  ListarProductosInput,
  ListarProductosResult,
  Producto,
} from "./schemas";

export async function crearProductoService(
  input: CrearProductoInput
): Promise<ActionResult<Producto>> {
  try {
    const producto = await crearProductoRepo({
      ...input,
      precio_usd: round2(input.precio_usd),
    });
    return okResult(producto);
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function actualizarProductoService(
  input: ActualizarProductoInput
): Promise<ActionResult<Producto>> {
  try {
    const producto = await actualizarProductoRepo({
      ...input,
      precio_usd: round2(input.precio_usd),
    });
    return okResult(producto);
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function eliminarProductoService(id: string): Promise<ActionResult<null>> {
  try {
    if (await tieneMovimientosRepo(id)) {
      return errorResult(
        "PRODUCTO_CON_MOVIMIENTOS",
        "No se puede eliminar: el producto tiene movimientos en facturas."
      );
    }
    await eliminarProductoRepo(id);
    return okResult(null);
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function obtenerProductoService(id: string): Promise<ActionResult<Producto>> {
  try {
    const producto = await obtenerProductoRepo(id);
    return okResult(producto);
  } catch (error) {
    if (esErrorNoEncontrado(error)) {
      return errorResult("PRODUCTO_NOT_FOUND", "El producto no existe.");
    }
    return fromPostgresError(error);
  }
}

export async function listarProductosService(
  input: ListarProductosInput
): Promise<ActionResult<ListarProductosResult>> {
  try {
    const data = await listarProductosRepo(input.busqueda, input.pagina, input.porPagina);
    return okResult(data);
  } catch (error) {
    return fromPostgresError(error);
  }
}

export async function listarStockBajoService(
  umbral: number,
  limite: number
): Promise<ActionResult<Producto[]>> {
  try {
    const productos = await listarStockBajoRepo(umbral, limite);
    return okResult(productos);
  } catch (error) {
    return fromPostgresError(error);
  }
}

const FORMATOS_PERMITIDOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// La foto llega comprimida desde el front (~100-150 KB); se acepta hasta 1 MB.
const TAMANO_MAXIMO = 1024 * 1024;

function pathDeUrlPublica(url: string): string | null {
  const marcador = "/storage/v1/object/public/productos/";
  const indice = url.indexOf(marcador);
  if (indice === -1) return null;
  return url.slice(indice + marcador.length).split("?")[0] ?? null;
}

export async function subirFotoProductoService(
  productoId: string,
  archivo: File
): Promise<ActionResult<{ foto_url: string }>> {
  const extension = FORMATOS_PERMITIDOS[archivo.type];
  if (!extension) {
    return errorResult("FOTO_INVALIDA", "Formato no permitido. Use JPEG, PNG o WebP.");
  }
  if (archivo.size <= 0 || archivo.size > TAMANO_MAXIMO) {
    return errorResult("FOTO_INVALIDA", "La imagen debe pesar como máximo 1 MB.");
  }

  const productoRes = await obtenerProductoService(productoId);
  if (!productoRes.ok) return productoRes;
  const producto = productoRes.data;

  const nombreArchivo = `${producto.codigo}-${Date.now()}.${extension}`;

  try {
    await subirFotoRepo(nombreArchivo, archivo, archivo.type);
    const fotoUrl = obtenerPublicUrlRepo(nombreArchivo);

    await actualizarFotoRepo(producto.id, fotoUrl);

    // Al reemplazar se sube un archivo nuevo y se elimina el anterior.
    const pathAnterior = producto.foto_url ? pathDeUrlPublica(producto.foto_url) : null;
    if (pathAnterior && pathAnterior !== nombreArchivo) {
      try {
        await eliminarFotoRepo(pathAnterior);
      } catch {
        // La foto vieja no debe bloquear la actualización.
      }
    }

    return okResult({ foto_url: fotoUrl });
  } catch (error) {
    return fromPostgresError(error);
  }
}