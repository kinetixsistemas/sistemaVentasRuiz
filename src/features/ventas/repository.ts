import { createSupabaseServerClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/currency";
import { escaparFiltroPostgrest } from "@/lib/postgrest";
import type { Database } from "@/types/database";
import type {
  ActualizarComisionFacturaInput,
  CrearFacturaInput,
  FacturaConSaldo,
  FacturaDetalle,
  ItemFactura,
  ListarFacturasInput,
  ListarFacturasResult,
  PagoFactura,
  ResumenCartera,
  ResumenVentas,
  ResumenVentasInput,
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

export async function crearFacturaRepo(input: CrearFacturaInput): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crear_factura", {
    p_cliente_id: input.cliente_id,
    p_numero_factura: input.numero_factura,
    p_condicion: input.condicion,
    p_dias_credito: input.dias_credito,
    p_items: input.modo_manual ? [] : input.items.map((item) => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_unitario_usd: round2(item.precio_unitario_usd),
    })),
    p_descuento_usd: round2(input.descuento_usd),
    p_modo_manual: input.modo_manual ?? false,
    p_monto_manual_usd: input.modo_manual && input.monto_manual_usd !== undefined ? round2(input.monto_manual_usd) : null,
    p_comision_pct: input.comision_pct ?? null,
    p_comision_usd: input.comision_usd ?? null,
  });
  if (error) throw error;
  return data;
}

export async function actualizarComisionFacturaRepo(
  input: ActualizarComisionFacturaInput
): Promise<{ comision_pct: number; comision_usd: number }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("actualizar_comision_factura", {
    p_factura_id: input.id,
    p_comision_pct: input.comision_pct,
    p_comision_usd: input.comision_usd,
  });
  if (error) throw error;

  const fila = data?.[0];
  if (!fila) throw new Error("No se pudo actualizar la comisión");
  return {
    comision_pct: Number(fila.comision_pct),
    comision_usd: Number(fila.comision_usd),
  };
}

export async function listarFacturasRepo(input: ListarFacturasInput): Promise<ListarFacturasResult> {
  const supabase = await createSupabaseServerClient();

  let consulta = supabase.from("facturas_con_saldo").select(COLUMNAS_VISTA, { count: "exact" });

  if (input.cliente_id) consulta = consulta.eq("cliente_id", input.cliente_id);
  if (input.fecha_desde) consulta = consulta.gte("fecha_emision", input.fecha_desde);
  if (input.fecha_hasta) consulta = consulta.lte("fecha_emision", input.fecha_hasta);
  if (input.estado && input.estado !== "todas") consulta = consulta.eq("estado", input.estado);

  if (input.busqueda) {
    const patron = escaparFiltroPostgrest(`%${input.busqueda}%`);
    consulta = consulta.or(
      `numero_factura.ilike.${patron},nombre_juridico.ilike.${patron},rif.ilike.${patron}`
    );
  }

  const desde = (input.pagina - 1) * input.porPagina;
  const consultaOrdenada =
    input.orden === "reciente"
      ? consulta
          .order("fecha_emision", { ascending: false })
          .order("numero_orden", { ascending: false })
      : consulta
          .order("numero_orden", { ascending: true })
          .order("numero_factura", { ascending: true });

  const { data, error, count } = await consultaOrdenada.range(desde, desde + input.porPagina - 1);

  if (error) throw error;
  return {
    facturas: (data ?? []).map(mapearFacturaConSaldo),
    total: count ?? 0,
  };
}

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

export async function resumenCarteraRepo(): Promise<ResumenCartera> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("resumen_cartera");
  if (error) throw error;
  return data as ResumenCartera;
}

export async function resumenVentasPeriodoRepo(input: ResumenVentasInput): Promise<ResumenVentas> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("resumen_ventas_periodo", {
    p_desde: input.desde,
    p_hasta: input.hasta,
  });
  if (error) throw error;
  return data as ResumenVentas;
}

export async function obtenerFacturaDetalleRepo(id: string): Promise<FacturaDetalle> {
  const supabase = await createSupabaseServerClient();

  const [facturaRes, itemsRes, pagosRes, comisionRes] = await Promise.all([
    supabase
      .from("facturas")
      .select(
        "id, numero_factura, fecha_emision, condicion, dias_credito, fecha_vencimiento, total_usd, descuento_usd, comision_pct, comision_usd, clientes(id, rif, nombre_juridico)"
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
    supabase
      .from("comisiones_vendedor")
      .select("id")
      .eq("factura_id", id)
      .maybeSingle(),
  ]);

  if (facturaRes.error) throw facturaRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (pagosRes.error) throw pagosRes.error;
  if (comisionRes.error) throw comisionRes.error;

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
    descuento_usd: factura.descuento_usd,
    comision_pct: Number(factura.comision_pct ?? 0),
    comision_usd: Number(factura.comision_usd ?? 0),
    comision_pagada: Boolean(comisionRes.data),
    cliente: {
      id: factura.clientes.id,
      rif: factura.clientes.rif,
      nombre_juridico: factura.clientes.nombre_juridico,
    },
    items: itemesTipados,
    pagos,
  };
}
