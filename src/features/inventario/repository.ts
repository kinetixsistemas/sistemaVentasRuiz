import { round2 } from "@/lib/currency";
import { escaparFiltroPostgrest } from "@/lib/postgrest";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  ActualizarProductoInput,
  Categoria,
  CategoriaFiltro,
  CrearProductoInput,
  ExistenciaFiltro,
  Producto,
  SugerenciaProducto,
} from "./schemas";

type ProductoFila = Database["public"]["Tables"]["productos"]["Row"];
type CategoriaFila = Database["public"]["Tables"]["categorias"]["Row"];
type ProductoSeleccion = Pick<
  ProductoFila,
  "id" | "codigo" | "nombre" | "cantidad" | "precio_usd" | "foto_url" | "categoria_id"
>;

const COLUMNAS = "id, codigo, nombre, cantidad, precio_usd, foto_url, categoria_id";

function mapearProducto(fila: ProductoSeleccion): Producto {
  return {
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    cantidad: fila.cantidad,
    precio_usd: fila.precio_usd,
    foto_url: fila.foto_url,
    categoria_id: fila.categoria_id,
  };
}

function mapearCategoria(fila: Pick<CategoriaFila, "id" | "nombre">): Categoria {
  return { id: fila.id, nombre: fila.nombre };
}

export async function listarProductosRepo(
  busqueda: string | undefined,
  existencia: ExistenciaFiltro,
  categorias: CategoriaFiltro,
  pagina: number,
  porPagina: number
) {
  const supabase = await createSupabaseServerClient();

  let consulta = supabase.from("productos").select(COLUMNAS, { count: "exact" });
  if (busqueda) {
    consulta = consulta.or(
      `codigo.ilike.${escaparFiltroPostgrest(`%${busqueda}%`)},nombre.ilike.${escaparFiltroPostgrest(`%${busqueda}%`)}`
    );
  }
  if (existencia === "con") consulta = consulta.gt("cantidad", 0);
  else if (existencia === "sin") consulta = consulta.eq("cantidad", 0);
  if (categorias && categorias !== "sin") consulta = consulta.eq("categoria_id", categorias);
  else if (categorias === "sin") consulta = consulta.is("categoria_id", null);

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

/** Lista completa para exportar a PDF, paginando en bloques de 1000. */
export async function listarProductosParaPdfRepo(
  busqueda: string | undefined,
  existencia: ExistenciaFiltro,
  categorias: CategoriaFiltro
): Promise<Producto[]> {
  const supabase = await createSupabaseServerClient();
  const tamano = 1000;
  const productos: Producto[] = [];

  for (let desde = 0; ; desde += tamano) {
    let consulta = supabase.from("productos").select(COLUMNAS);
    if (busqueda) {
      consulta = consulta.or(
        `codigo.ilike.${escaparFiltroPostgrest(`%${busqueda}%`)},nombre.ilike.${escaparFiltroPostgrest(`%${busqueda}%`)}`
      );
    }
    if (existencia === "con") consulta = consulta.gt("cantidad", 0);
    else if (existencia === "sin") consulta = consulta.eq("cantidad", 0);
    if (categorias && categorias !== "sin") consulta = consulta.eq("categoria_id", categorias);
    else if (categorias === "sin") consulta = consulta.is("categoria_id", null);

    const { data, error } = await consulta
      .order("codigo", { ascending: true })
      .range(desde, desde + tamano - 1);
    if (error) throw error;

    const bloque = (data ?? []).map(mapearProducto);
    productos.push(...bloque);
    if (bloque.length < tamano) break;
  }

  return productos;
}

/**
 * Sugerencias de búsqueda por código o nombre. Devuelve coincidencias parciales
 * ordenadas por relevancia (prefijo exacto primero, luego por nombre) para
 * tolerar búsquedas escritas a medias o con errores leves de orden.
 */
export async function listarSugerenciasRepo(
  busqueda: string,
  limite: number
): Promise<SugerenciaProducto[]> {
  const supabase = await createSupabaseServerClient();
  const patron = escaparFiltroPostgrest(`%${busqueda}%`);
  const { data, error } = await supabase
    .from("productos")
    .select("id, codigo, nombre, cantidad")
    .or(`codigo.ilike.${patron},nombre.ilike.${patron}`)
    .order("nombre", { ascending: true })
    .limit(limite);
  if (error) throw error;

  const normalizado = busqueda.toLowerCase();
  return (data ?? [])
    .map((fila) => ({
      id: fila.id,
      codigo: fila.codigo,
      nombre: fila.nombre,
      cantidad: fila.cantidad,
    }))
    .sort((a, b) => {
      const prioridad = (p: SugerenciaProducto) =>
        p.codigo.toLowerCase().startsWith(normalizado) ||
        p.nombre.toLowerCase().startsWith(normalizado)
          ? 0
          : 1;
      return prioridad(a) - prioridad(b);
    });
}

export async function listarCategoriasRepo(): Promise<Categoria[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categorias")
    .select("id, nombre")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapearCategoria);
}

export async function obtenerCategoriaPorNombreRepo(nombre: string): Promise<Categoria | null> {
  const supabase = await createSupabaseServerClient();
  const escapado = nombre.replace(/[\\%_]/g, "\\$&");
  const { data, error } = await supabase
    .from("categorias")
    .select("id, nombre")
    .ilike("nombre", escapado)
    .maybeSingle();
  if (error) throw error;
  return data ? mapearCategoria(data) : null;
}

export async function crearCategoriaRepo(nombre: string): Promise<Categoria> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categorias")
    .insert({ nombre })
    .select("id, nombre")
    .single();
  if (error) throw error;
  return mapearCategoria(data);
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
    categoria_id: null,
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
      categoria_id: input.categoria_id ?? null,
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
      categoria_id: input.categoria_id ?? null,
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