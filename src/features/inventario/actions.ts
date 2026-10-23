"use server";

import { updateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  errorResult,
  fromZodError,
  type ActionResult,
} from "@/lib/result";
import { TAG_PRODUCTOS } from "@/lib/tags";
import {
  actualizarProductoService,
  crearCategoriaService,
  crearProductoService,
  eliminarProductoService,
  listarCategoriasService,
  listarProductosService,
  listarStockBajoService,
  listarSugerenciasService,
  obtenerProductoService,
  subirFotoProductoService,
} from "./service";
import {
  actualizarProductoSchema,
  crearCategoriaSchema,
  crearProductoSchema,
  listarProductosSchema,
  listarStockBajoSchema,
  sugerenciasProductosSchema,
  type Categoria,
  type ListarProductosResult,
  type Producto,
  type SugerenciaProducto,
} from "./schemas";

export async function crearProducto(input: unknown): Promise<ActionResult<Producto>> {
  await requireUser();
  const parsed = crearProductoSchema.safeParse(input);
  if (!parsed.success) return fromZodError<Producto>(parsed.error);

  const result = await crearProductoService(parsed.data);
  if (result.ok) updateTag(TAG_PRODUCTOS);
  return result;
}

export async function actualizarProducto(input: unknown): Promise<ActionResult<Producto>> {
  await requireUser();
  const parsed = actualizarProductoSchema.safeParse(input);
  if (!parsed.success) return fromZodError<Producto>(parsed.error);

  const result = await actualizarProductoService(parsed.data);
  if (result.ok) updateTag(TAG_PRODUCTOS);
  return result;
}

export async function eliminarProducto(productoId: unknown): Promise<ActionResult<null>> {
  await requireUser();
  if (typeof productoId !== "string" || !productoId.trim()) {
    return errorResult("VALIDATION", "Falta el identificador del producto.");
  }

  const result = await eliminarProductoService(productoId.trim());
  if (result.ok) updateTag(TAG_PRODUCTOS);
  return result;
}

export async function obtenerProducto(productoId: unknown): Promise<ActionResult<Producto>> {
  await requireUser();
  if (typeof productoId !== "string" || !productoId.trim()) {
    return errorResult("VALIDATION", "Falta el identificador del producto.");
  }
  return obtenerProductoService(productoId.trim());
}

export async function listarProductos(input?: unknown): Promise<ActionResult<ListarProductosResult>> {
  await requireUser();
  const parsed = listarProductosSchema.safeParse(input ?? {});
  if (!parsed.success) return fromZodError<ListarProductosResult>(parsed.error);
  return listarProductosService(parsed.data);
}

export async function listarCategorias(): Promise<ActionResult<Categoria[]>> {
  await requireUser();
  return listarCategoriasService();
}

export async function listarSugerenciasProductos(
  input: unknown
): Promise<ActionResult<SugerenciaProducto[]>> {
  await requireUser();
  const parsed = sugerenciasProductosSchema.safeParse(input);
  if (!parsed.success) return fromZodError<SugerenciaProducto[]>(parsed.error);
  return listarSugerenciasService(parsed.data.busqueda, parsed.data.limite);
}

export async function crearCategoria(input: unknown): Promise<ActionResult<Categoria>> {
  await requireUser();
  const parsed = crearCategoriaSchema.safeParse(input);
  if (!parsed.success) return fromZodError<Categoria>(parsed.error);

  const result = await crearCategoriaService(parsed.data.nombre);
  if (result.ok) updateTag(TAG_PRODUCTOS);
  return result;
}

/**
 * Productos con existencias bajas para el panel inicial.
 * Calculado en la BD (RPC `productos_stock_bajo`).
 */
export async function listarStockBajo(input?: unknown): Promise<ActionResult<Producto[]>> {
  await requireUser();
  const parsed = listarStockBajoSchema.safeParse(input ?? {});
  if (!parsed.success) return fromZodError<Producto[]>(parsed.error);
  return listarStockBajoService(parsed.data.umbral, parsed.data.limite);
}

/**
 * Sube la foto de un producto a Supabase Storage.
 * Espera un FormData con `producto_id` y `foto` (archivo de imagen ya comprimido).
 */
export async function subirFotoProducto(
  formData: FormData
): Promise<ActionResult<{ foto_url: string }>> {
  await requireUser();

  const productoIdInput = formData.get("producto_id");
  const archivo = formData.get("foto");

  if (typeof productoIdInput !== "string" || !productoIdInput.trim()) {
    return errorResult("VALIDATION", "Falta el identificador del producto.");
  }
  if (!(archivo instanceof File)) {
    return errorResult("FOTO_INVALIDA", "Debe seleccionar un archivo de imagen.");
  }

  const result = await subirFotoProductoService(productoIdInput.trim(), archivo);
  if (result.ok) updateTag(TAG_PRODUCTOS);
  return result;
}