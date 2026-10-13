import { escaparFiltroPostgrest } from "@/lib/postgrest";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { ActualizarClienteInput, Cliente, CrearClienteInput } from "./schemas";

type ClienteFila = Database["public"]["Tables"]["clientes"]["Row"];

const COLUMNAS =
  "id, rif, nombre_juridico, nombre_encargado, telefono, correo, direccion, vendedor";

type ClienteSeleccion = Pick<
  ClienteFila,
  | "id"
  | "rif"
  | "nombre_juridico"
  | "nombre_encargado"
  | "telefono"
  | "correo"
  | "direccion"
  | "vendedor"
>;

function mapearCliente(fila: ClienteSeleccion): Cliente {
  return {
    id: fila.id,
    rif: fila.rif,
    nombre_juridico: fila.nombre_juridico,
    nombre_encargado: fila.nombre_encargado,
    telefono: fila.telefono,
    correo: fila.correo,
    direccion: fila.direccion,
    vendedor: fila.vendedor,
  };
}

export async function listarClientesRepo(
  busqueda: string | undefined,
  pagina: number,
  porPagina: number
) {
  const supabase = await createSupabaseServerClient();

  const consulta = busqueda
    ? supabase
        .from("clientes")
        .select(COLUMNAS, { count: "exact" })
        .or(
          `rif.ilike.${escaparFiltroPostgrest(`%${busqueda}%`)},nombre_juridico.ilike.${escaparFiltroPostgrest(`%${busqueda}%`)}`
        )
    : supabase.from("clientes").select(COLUMNAS, { count: "exact" });

  const desde = (pagina - 1) * porPagina;
  const { data, error, count } = await consulta
    .order("nombre_juridico", { ascending: true })
    .range(desde, desde + porPagina - 1);

  if (error) throw error;

  return {
    clientes: (data ?? []).map(mapearCliente),
    total: count ?? 0,
  };
}

export async function obtenerClienteRepo(id: string): Promise<Cliente> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("clientes").select(COLUMNAS).eq("id", id).single();
  if (error) throw error;
  return mapearCliente(data);
}

export async function crearClienteRepo(input: CrearClienteInput): Promise<Cliente> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("clientes").insert({ ...input }).select(COLUMNAS).single();
  if (error) throw error;
  return mapearCliente(data);
}

export async function actualizarClienteRepo(input: ActualizarClienteInput): Promise<Cliente> {
  const supabase = await createSupabaseServerClient();
  const { id, ...resto } = input;
  const { data, error } = await supabase
    .from("clientes")
    .update({ ...resto })
    .eq("id", id)
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return mapearCliente(data);
}

export async function eliminarClienteRepo(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) throw error;
}

/** Verifica si el cliente tiene facturas asociadas (bloquea la eliminación). */
export async function tieneFacturasRepo(clienteId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("facturas")
    .select("id")
    .eq("cliente_id", clienteId)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}