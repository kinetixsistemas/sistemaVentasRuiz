import { createSupabaseServerClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/currency";
import { escaparFiltroPostgrest } from "@/lib/postgrest";
import type { Database } from "@/types/database";
import type {
  CrearFacturaInput,
  FacturaConSaldo,
  FacturaDetalle,
  ItemFactura,
  ListarFacturasInput,
  PagoFactura,
  ResumenCartera,
} from "./schemas";

type FacturaFila = Database["public"]["Tables"]["facturas"]["Row"];
type FacturaItemsFila = Database["public"]["Tables"]["factura_items"]["Row"];
type VistaFila = Database["public"]["Views"]["facturas_con_saldo"]["Row"];

const COLUMNAS_VISTA =
  "id, numero_factura, cliente_id, rif, nombre_juridico, vendedor, fecha_emision, condicion, dias_credito, fecha_vencimiento, total_usd, total_pagado_usd, saldo_usd, estado, dias_mora";

type VistaSeleccion = Pick<
  VistaFila,
  | "id"
  | "numero_factura"
  | "cliente_id"
  | "rif"
  | "nombre_juridico"
  | "vendedor"
  | "fecha_emision"
  | "condicion"
  | "dias_credito"
  | "fecha_vencimiento"
  | "total_usd"
  | "total_pagado_usd"
  | "saldo_usd"
  | "estado"
  | "dias_mora"
>;

function mapearFacturaConSaldo(fila: VistaSeleccion): FacturaConSaldo {
  return {
    id: fila.id,
    numero_factura: fila.numero_factura,
    cliente_id: fila.cliente_id,
    rif: fila.rif,
    nombre_juridico: fila.nombre_juridico,
    vendedor: fila.vendedor,
    fecha_emision: fila.fecha_emision,
    condicion: fila.condicion,
    dias_credito: fila.dias_credito,
    fecha_vencimiento: fila.fecha_vencimiento,
    total_usd: fila.total_usd,
    total_pagado_usd: fila.total_pagado_usd,
    saldo_usd: fila.saldo_usd,
    estado: fila.estado,
    dias_mora: fila.dias_mora,
  };
}

/** Crea la factura llamando a la RPC `crear_factura` (total y stock en la BD). */
export async function crearFacturaRepo(input: CrearFacturaInput): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crear_factura", {
    p_cliente_id: input.cliente_id,
    p_numero_factura: input.numero_factura,
    p_condicion: input.condicion,
    p_dias_credito: input.dias_credito,
    p_items: input.items.map((item) => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_unitario_usd: round2(item.precio_unitario_usd),
    })),
  });
  if (error) throw error;
  return data;
}

export async function listarFacturasRepo(input: ListarFacturasInput): Promise<FacturaConSaldo[]> {
  const supabase = await createSupabaseServerClient();

  let consulta = supabase.from("facturas_con_saldo").select(COLUMNAS_VISTA);

  if (input.cliente_id) consulta = consulta.eq("cliente_id", input.cliente_id);
  if (input.fecha_desde) consulta = consulta.gte("fecha_emision", input.fecha_desde);
  if (input.fecha_hasta) consulta = consulta.lte("fecha_emision", input.fecha_hasta);
  if (input.estado && input.estado !== "todas") consulta = consulta.eq("estado", input.estado);

  // Búsqueda resuelta en la BD (no se descarga todo el histórico para filtrar).
  if (input.busqueda) {
    const patron = escaparFiltroPostgrest(`%${input.busqueda}%`);
    consulta = consulta.or(
      `numero_factura.ilike.${patron},nombre_juridico.ilike.${patron},rif.ilike.${patron}`
    );
  }

  consulta = consulta.order("fecha_emision", { ascending: false });
  if (input.limite) consulta = consulta.limit(input.limite);

  const { data, error } = await consulta;
  if (error) throw error;
  return (data ?? []).map(mapearFacturaConSaldo);
}

/** Una factura con su saldo (para reflejarla en la lista sin recargarla). */
export async function obtenerFacturaConSaldoRepo(id: string): Promise<FacturaConSaldo> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("facturas_con_saldo")
    .select(COLUMNAS_VISTA)
    .eq("id", id)
    .single<VistaSeleccion>();
  if (error) throw error;
  return mapearFacturaConSaldo(data);
}

/** KPIs de cartera agregados en la BD (evita transferir todas las facturas). */
export async function resumenCarteraRepo(): Promise<ResumenCartera> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("resumen_cartera");
  if (error) throw error;
  return data as ResumenCartera;
}

/** Factura con ítems (con datos del producto), pagos y datos del cliente. */
export async function obtenerFacturaDetalleRepo(id: string): Promise<FacturaDetalle> {
  const supabase = await createSupabaseServerClient();

  // El cliente se trae embebido en la factura y los tres consultas corren en
  // paralelo: antes eran 4 viajes secuenciales a la base de datos.
  const [facturaRes, itemsRes, pagosRes] = await Promise.all([
    supabase
      .from("facturas")
      .select(
        "id, numero_factura, fecha_emision, condicion, dias_credito, fecha_vencimiento, total_usd, clientes(id, rif, nombre_juridico)"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("factura_items")
      .select("id, producto_id, cantidad, precio_unitario_usd, subtotal_usd, productos(id, codigo, nombre)")
      .eq("factura_id", id)
      .order("id", { ascending: true }),
    supabase
      .from("pagos")
      .select("id, fecha, metodo, monto_original, moneda, tasa_cambio, monto_usd, referencia, correo")
      .eq("factura_id", id)
      .order("fecha", { ascending: false }),
  ]);

  if (facturaRes.error) throw facturaRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (pagosRes.error) throw pagosRes.error;

  const factura = facturaRes.data as unknown as FacturaFila & {
    clientes: { id: string; rif: string; nombre_juridico: string } | null;
  };
  if (!factura.clientes) throw new Error("La factura no tiene cliente asociado.");

  const items = (itemsRes.data ?? []) as unknown as Array<
    FacturaItemsFila & { productos: { id: string; codigo: string; nombre: string } | null }
  >;
  const itemesTipados: ItemFactura[] = items.map((item) => ({
    id: item.id,
    producto_id: item.producto_id,
    cantidad: item.cantidad,
    precio_unitario_usd: item.precio_unitario_usd,
    subtotal_usd: item.subtotal_usd,
    producto: item.productos
      ? { codigo: item.productos.codigo, nombre: item.productos.nombre }
      : null,
  }));

  const pagos = (pagosRes.data ?? []) as PagoFactura[];

  return {
    id: factura.id,
    numero_factura: factura.numero_factura,
    fecha_emision: factura.fecha_emision,
    condicion: factura.condicion,
    dias_credito: factura.dias_credito,
    fecha_vencimiento: factura.fecha_vencimiento,
    total_usd: factura.total_usd,
    cliente: {
      id: factura.clientes.id,
      rif: factura.clientes.rif,
      nombre_juridico: factura.clientes.nombre_juridico,
    },
    items: itemesTipados,
    pagos,
  };
}