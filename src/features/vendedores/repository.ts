import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  ActualizarVendedorInput,
  ComisionVendedor,
  CrearVendedorInput,
  FacturaVendedor,
  HistorialVendedorResult,
  PagarComisionVendedorInput,
  Vendedor,
  VendedorResumen,
} from "./schemas";

type VendedorFila = Database["public"]["Tables"]["vendedores"]["Row"];
type ComisionFila = Database["public"]["Tables"]["comisiones_vendedor"]["Row"];
type ResumenFila = Database["public"]["Functions"]["resumen_vendedores"]["Returns"][number];
type ComisionPagadaFila =
  Database["public"]["Functions"]["pagar_comision_vendedor"]["Returns"][number];
type VistaFila = Database["public"]["Views"]["facturas_con_saldo"]["Row"];

const COLUMNAS = "id, nombre, comision_pct, activo, created_at, updated_at";

const COLUMNAS_HISTORIAL =
  "id, numero_factura, nombre_juridico, fecha_emision, fecha_vencimiento, total_usd, total_pagado_usd, saldo_usd, estado, dias_mora, comision_pct, comision_usd";

const COLUMNAS_COMISION =
  "id, factura_id, vendedor_id, base_usd, comision_pct, monto_usd, pagada_at, fecha, metodo, moneda, monto_original, tasa_cambio, referencia, correo";

type HistorialFila = Pick<
  VistaFila,
  | "id"
  | "numero_factura"
  | "nombre_juridico"
  | "fecha_emision"
  | "fecha_vencimiento"
  | "total_usd"
  | "total_pagado_usd"
  | "saldo_usd"
  | "estado"
  | "dias_mora"
  | "comision_pct"
  | "comision_usd"
>;

function numero(valor: number | string | null | undefined): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function mapearVendedor(fila: VendedorFila): Vendedor {
  return {
    id: fila.id,
    nombre: fila.nombre,
    comision_pct: numero(fila.comision_pct),
    activo: fila.activo,
    created_at: fila.created_at,
    updated_at: fila.updated_at,
  };
}

function mapearResumen(fila: ResumenFila): VendedorResumen {
  return {
    id: fila.id,
    nombre: fila.nombre,
    comision_pct: numero(fila.comision_pct),
    activo: fila.activo,
    facturas_periodo: numero(fila.facturas_periodo),
    pagadas_periodo: numero(fila.pagadas_periodo),
    pendientes_periodo: numero(fila.pendientes_periodo),
    vendido_periodo_usd: numero(fila.vendido_periodo_usd),
    cobrado_periodo_usd: numero(fila.cobrado_periodo_usd),
    saldo_periodo_usd: numero(fila.saldo_periodo_usd),
    facturas_total: numero(fila.facturas_total),
    pagadas_total: numero(fila.pagadas_total),
    vendido_total_usd: numero(fila.vendido_total_usd),
    comision_total_usd: numero(fila.comision_total_usd),
    comision_pagada_usd: numero(fila.comision_pagada_usd),
    comision_pendiente_usd: numero(fila.comision_pendiente_usd),
    comisiones_pagadas: numero(fila.comisiones_pagadas),
  };
}

function mapearComision(fila: ComisionFila | ComisionPagadaFila): ComisionVendedor {
  const id = "comision_id" in fila ? fila.comision_id : fila.id;
  return {
    id,
    factura_id: fila.factura_id,
    vendedor_id: fila.vendedor_id,
    base_usd: numero(fila.base_usd),
    comision_pct: numero(fila.comision_pct),
    monto_usd: numero(fila.monto_usd),
    pagada_at: fila.pagada_at,
    fecha: "fecha" in fila && fila.fecha ? fila.fecha : fila.pagada_at.slice(0, 10),
    metodo: "metodo" in fila && fila.metodo ? fila.metodo : "efectivo",
    moneda: "moneda" in fila && fila.moneda ? fila.moneda : "USD",
    monto_original:
      "monto_original" in fila && fila.monto_original != null
        ? numero(fila.monto_original)
        : numero(fila.monto_usd),
    tasa_cambio: "tasa_cambio" in fila && fila.tasa_cambio != null ? numero(fila.tasa_cambio) : null,
    referencia: "referencia" in fila ? fila.referencia : null,
    correo: "correo" in fila ? fila.correo : null,
  };
}

function mapearFacturaVendedor(
  fila: HistorialFila,
  comision: ComisionVendedor | undefined
): FacturaVendedor {
  return {
    factura_id: fila.id,
    numero_factura: fila.numero_factura,
    nombre_juridico: fila.nombre_juridico,
    fecha_emision: fila.fecha_emision,
    fecha_vencimiento: fila.fecha_vencimiento,
    total_usd: numero(fila.total_usd),
    total_pagado_usd: numero(fila.total_pagado_usd),
    saldo_usd: numero(fila.saldo_usd),
    estado: fila.estado,
    dias_mora: numero(fila.dias_mora),
    comision_pct: numero(fila.comision_pct),
    comision_usd: numero(fila.comision_usd),
    comision: comision ?? null,
  };
}

export async function listarVendedoresRepo(): Promise<Vendedor[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vendedores")
    .select(COLUMNAS)
    .order("nombre", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapearVendedor);
}

export async function resumenVendedoresRepo(
  desde: string | undefined,
  hasta: string | undefined
): Promise<VendedorResumen[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("resumen_vendedores", {
    p_desde: desde ?? null,
    p_hasta: hasta ?? null,
  });
  if (error) throw error;
  return (data ?? []).map(mapearResumen);
}

export async function historialVendedorRepo(
  vendedorId: string,
  pagina: number,
  porPagina: number
): Promise<HistorialVendedorResult> {
  const supabase = await createSupabaseServerClient();
  const desde = (pagina - 1) * porPagina;

  const { data, error, count } = await supabase
    .from("facturas_con_saldo")
    .select(COLUMNAS_HISTORIAL, { count: "exact" })
    .eq("vendedor_id", vendedorId)
    .order("fecha_emision", { ascending: false })
    .order("numero_factura", { ascending: false })
    .range(desde, desde + porPagina - 1);

  if (error) throw error;

  const filas = (data ?? []) as HistorialFila[];
  const facturaIds = filas.map((fila) => fila.id);

  let comisiones: ComisionVendedor[] = [];
  if (facturaIds.length > 0) {
    const { data: comisionesData, error: comisionesError } = await supabase
      .from("comisiones_vendedor")
      .select(COLUMNAS_COMISION)
      .in("factura_id", facturaIds);
    if (comisionesError) throw comisionesError;
    comisiones = ((comisionesData ?? []) as ComisionFila[]).map(mapearComision);
  }

  const comisionPorFactura = new Map(comisiones.map((c) => [c.factura_id, c]));

  return {
    facturas: filas.map((fila) =>
      mapearFacturaVendedor(fila, comisionPorFactura.get(fila.id))
    ),
    total: count ?? 0,
  };
}

export async function pagarComisionVendedorRepo(
  input: PagarComisionVendedorInput
): Promise<ComisionVendedor> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("pagar_comision_vendedor", {
    p_factura_id: input.factura_id,
    p_metodo: input.metodo,
    p_monto: input.monto,
    p_tasa: input.tasa_cambio ?? null,
    p_referencia: input.referencia ?? null,
    p_correo: input.correo ?? null,
    p_fecha: input.fecha ?? null,
  });
  if (error) throw error;

  const fila = (data?.[0] ?? null) as ComisionPagadaFila | null;
  if (!fila) throw new Error("No se pudo registrar la comisión");
  return mapearComision(fila);
}

export async function crearVendedorRepo(input: CrearVendedorInput): Promise<Vendedor> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vendedores")
    .insert({
      nombre: input.nombre,
      comision_pct: input.comision_pct,
      activo: input.activo,
    })
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return mapearVendedor(data);
}

export async function actualizarVendedorRepo(
  input: ActualizarVendedorInput
): Promise<Vendedor> {
  const supabase = await createSupabaseServerClient();
  const { id, ...resto } = input;
  const { data, error } = await supabase
    .from("vendedores")
    .update({
      nombre: resto.nombre,
      comision_pct: resto.comision_pct,
      activo: resto.activo,
    })
    .eq("id", id)
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return mapearVendedor(data);
}

export async function eliminarVendedorRepo(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("vendedores").delete().eq("id", id);
  if (error) throw error;
}

/** Uso del vendedor que impide eliminarlo (clientes o facturas asociadas). */
export async function contarUsoVendedorRepo(
  id: string
): Promise<{ clientes: number; facturas: number }> {
  const supabase = await createSupabaseServerClient();

  const [clientes, facturas] = await Promise.all([
    supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("vendedor_id", id),
    supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("vendedor_id", id),
  ]);

  if (clientes.error) throw clientes.error;
  if (facturas.error) throw facturas.error;

  return {
    clientes: clientes.count ?? 0,
    facturas: facturas.count ?? 0,
  };
}
