import { round2 } from "@/lib/currency";
import { escaparFiltroPostgrest } from "@/lib/postgrest";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { ActualizarProductoInput, CrearProductoInput, Producto } from "./schemas";

type ProductoFila = Database["public"]["Tables"]["productos"]["Row"];
type ProductoSeleccion = Pick<
  ProductoFila,
  "id" | "codigo" | "nombre" | "cantidad" | "precio_usd" | "foto_url"
>;

const COLUMNAS = "id, codigo, nombre, cantidad, precio_usd, foto_url";

function mapearProducto(fila: ProductoSeleccion): Producto {
  return {
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    cantidad: fila.cantidad,
    precio_usd: fila.precio_usd,
    foto_url: fila.foto_url,
  };
}

export async function listarProductosRepo(
  busqueda: string | undefined,
  pagina: number,
  porPagina: number
) {
  const supabase = await createSupabaseServerClient();

  const consulta = busqueda
    ? supabase
        .from("productos")
        .select(COLUMNAS, { count: "exact" })
        .or(
          `codigo.ilike.${escaparFiltroPostgrest(`%${busqueda}%`)},nombre.ilike.${escaparFiltroPostgrest(`%${busqueda}%`)}`
        )
    : supabase.from("productos").select(COLUMNAS, { count: "exact" });

  const desde = (pagina - 1) * porPagina;
  const { data, error, count } = await consulta
    .order("codigo", { ascending: true })
    .range(desde, desde + porPagina - 1);

  if (error) throw error;

  return {
    productos: (data ?? []).map(mapearProducto),
    total: count ?? 0,
  };
}

export async function obtenerProductoRepo(id: string): Promise<Producto> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("productos").select(COLUMNAS).eq("id", id).single();
  if (error) throw error;
  return mapearProducto(data);
}

/**
 * Productos con existencias bajas, calculado en la BD (RPC `productos_stock_bajo`).
 * Evita transferir todo el inventario para filtrarlo en el cliente.
 */
export async function listarStockBajoRepo(umbral: number, limite: number): Promise<Producto[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("productos_stock_bajo", {
    p_umbral: umbral,
    p_limite: limite,
  });
  if (error) throw error;
  return (data ?? []).map((fila) => ({
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    cantidad: fila.cantidad,
    precio_usd: Number(fila.precio_usd),
    foto_url: fila.foto_url,
  }));
}

export async function crearProductoRepo(input: CrearProductoInput): Promise<Producto> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("productos")
    .insert({
      codigo: input.codigo,
      nombre: input.nombre,
      cantidad: input.cantidad,
      precio_usd: round2(input.precio_usd),
    })
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return mapearProducto(data);
}

export async function actualizarProductoRepo(input: ActualizarProductoInput): Promise<Producto> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("productos")
    .update({
      codigo: input.codigo,
      nombre: input.nombre,
      cantidad: input.cantidad,
      precio_usd: round2(input.precio_usd),
    })
    .eq("id", input.id)
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return mapearProducto(data);
}

export async function eliminarProductoRepo(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (error) throw error;
}

/** Verifica si el producto tiene movimientos en facturas (bloquea la eliminación). */
export async function tieneMovimientosRepo(productoId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("factura_items")
    .select("id")
    .eq("producto_id", productoId)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** Actualiza únicamente la URL de la foto de un producto. */
export async function actualizarFotoRepo(productoId: string, fotoUrl: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("productos").update({ foto_url: fotoUrl }).eq("id", productoId);
  if (error) throw error;
}

export async function subirFotoRepo(
  nombreArchivo: string,
  archivo: Blob,
  contentType: string
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from("productos").upload(nombreArchivo, archivo, {
    cacheControl: "31536000",
    contentType,
    upsert: false,
  });
  if (error) throw error;
  return data.path;
}

export async function eliminarFotoRepo(path: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from("productos").remove([path]);
  if (error) throw error;
}

/** URL pública del bucket `productos` (sin llamar al servidor). */
export function obtenerPublicUrlRepo(path: string): string {
  const { url } = getSupabaseEnv();
  return `${url}/storage/v1/object/public/productos/${encodeURIComponent(path)}`;
}