import { escaparFiltroPostgrest } from "@/lib/postgrest";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  ActualizarClienteInput,
  Cliente,
  ClienteConCartera,
  CrearClienteInput,
} from "./schemas";

type ClienteFila = Database["public"]["Tables"]["clientes"]["Row"];
type ClienteInsert = Database["public"]["Tables"]["clientes"]["Insert"];
type ClienteUpdate = Database["public"]["Tables"]["clientes"]["Update"];
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Saldo que la app considera ya cancelado (misma tolerancia que cobranza). */
const TOLERANCIA_SALDO = 0.005;

const COLUMNAS =
  "id, rif, nombre_juridico, nombre_encargado, telefono, correo, direccion, vendedor_id";

type ClienteSeleccion = Pick<
  ClienteFila,
  | "id"
  | "rif"
  | "nombre_juridico"
  | "nombre_encargado"
  | "telefono"
  | "correo"
  | "direccion"
  | "vendedor_id"
>;

function mapearCliente(fila: ClienteSeleccion): Cliente {
  return {
    id: fila.id,
    rif: fila.rif,
    nombre_juridico: fila.nombre_juridico,
    nombre_encargado: fila.nombre_encargado,
    telefono: fila.telefono,
    correo: fila.correo ?? null,
    direccion: fila.direccion,
    vendedor_id: fila.vendedor_id,
  };
}

export async function listarClientesRepo(
  busqueda: string | undefined,
  pagina: number,
  porPagina: number
): Promise<{ clientes: ClienteConCartera[]; total: number }> {
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

  const clientes = (data ?? []).map(mapearCliente);
  const pendientes = await contarFacturasPendientes(
    supabase,
    clientes.map((c) => c.id)
  );

  return {
    clientes: clientes.map((c) => ({
      ...c,
      facturas_pendientes: pendientes.get(c.id) ?? 0,
    })),
    total: count ?? 0,
  };
}

/** Cuenta, por cliente, las facturas con saldo pendiente en la página actual. */
async function contarFacturasPendientes(
  supabase: SupabaseServerClient,
  clienteIds: string[]
): Promise<Map<string, number>> {
  const conteo = new Map<string, number>();
  if (clienteIds.length === 0) return conteo;

  const { data, error } = await supabase
    .from("facturas_con_saldo")
    .select("cliente_id")
    .in("cliente_id", clienteIds)
    .gt("saldo_usd", TOLERANCIA_SALDO);
  if (error) throw error;

  for (const fila of data ?? []) {
    conteo.set(fila.cliente_id, (conteo.get(fila.cliente_id) ?? 0) + 1);
  }
  return conteo;
}

export async function obtenerClienteRepo(id: string): Promise<Cliente> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("clientes").select(COLUMNAS).eq("id", id).single();
  if (error) throw error;
  return mapearCliente(data);
}

export async function crearClienteRepo(input: CrearClienteInput): Promise<Cliente> {
  const supabase = await createSupabaseServerClient();
  const payload: ClienteInsert = { ...input, correo: input.correo ?? null };
  const { data, error } = await supabase
    .from("clientes")
    .insert(payload)
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return mapearCliente(data as ClienteSeleccion);
}

export async function actualizarClienteRepo(input: ActualizarClienteInput): Promise<Cliente> {
  const supabase = await createSupabaseServerClient();
  const { id, ...resto } = input;
  const payload: ClienteUpdate = { ...resto };
  if ("correo" in payload) {
    const c = payload.correo;
    if (c === undefined) {
      delete payload.correo;
    } else if (c === null || c === "") {
      payload.correo = null;
    }
  }
  const { data, error } = await supabase
    .from("clientes")
    .update(payload)
    .eq("id", id)
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return mapearCliente(data as ClienteSeleccion);
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