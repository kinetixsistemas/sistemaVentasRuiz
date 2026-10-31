import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fechaHoyISO } from "@/lib/dates";
import { fromPostgresError, okResult, type ActionResult } from "@/lib/result";
import type { CondicionFactura, EstadoFactura, MetodoPago, MonedaPago } from "@/types/database";

export type PagoEstadoCuenta = {
  fecha: string;
  metodo: MetodoPago;
  moneda: MonedaPago;
  monto_original: number;
  monto_usd: number;
  referencia: string | null;
};

export type FacturaEstadoCuenta = {
  factura_id: string;
  numero_factura: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  condicion: CondicionFactura;
  total_usd: number;
  pagado_usd: number;
  saldo_usd: number;
  estado: EstadoFactura;
  pagos: PagoEstadoCuenta[];
};

export type EmpresaEstadoCuenta = {
  nombre_comercial: string;
  razon_social: string | null;
  rif: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
};

export type EstadoCuenta = {
  empresa: EmpresaEstadoCuenta | null;
  cliente: {
    id: string;
    rif: string;
    nombre_juridico: string;
    direccion: string;
    telefono: string;
  };
  generado_el: string;
  facturas: FacturaEstadoCuenta[];
  saldo_pendiente_total: number;
  /** Rango de emisión aplicado, o null si el estado de cuenta es completo. */
  rango: RangoEstadoCuenta | null;
};

/** Rango (inclusive) de emisión para el estado de cuenta. */
export type RangoEstadoCuenta = { desde: string; hasta: string };

/** Arma el estado de cuenta de un cliente (solo lectura, para PDF o pantalla). */
export async function obtenerEstadoCuentaRepo(
  clienteId: string,
  rango?: RangoEstadoCuenta
): Promise<EstadoCuenta> {
  const supabase = await createSupabaseServerClient();

  let facturasConsulta = supabase
    .from("facturas_con_saldo")
    .select(
      "id, numero_factura, fecha_emision, fecha_vencimiento, condicion, total_usd, total_pagado_usd, saldo_usd, estado"
    )
    .eq("cliente_id", clienteId);
  if (rango) {
    facturasConsulta = facturasConsulta
      .gte("fecha_emision", rango.desde)
      .lte("fecha_emision", rango.hasta);
  }

  // Cliente, empresa y facturas en paralelo; los pagos dependen de las facturas.
  const [clienteRes, empresaRes, facturasRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, rif, nombre_juridico, direccion, telefono")
      .eq("id", clienteId)
      .single(),
    supabase
      .from("empresa")
      .select("nombre_comercial, razon_social, rif, telefono, correo, direccion")
      .eq("id", 1)
      .maybeSingle(),
    facturasConsulta
      .order("numero_orden", { ascending: true })
      .order("numero_factura", { ascending: true }),
  ]);

  if (clienteRes.error) throw clienteRes.error;
  if (empresaRes.error) throw empresaRes.error;
  if (facturasRes.error) throw facturasRes.error;

  const facturaIds = (facturasRes.data ?? []).map((f) => f.id);
  const pagosRes =
    facturaIds.length > 0
      ? await supabase
          .from("pagos")
          .select("factura_id, fecha, metodo, moneda, monto_original, monto_usd, referencia")
          .in("factura_id", facturaIds)
          .order("fecha", { ascending: true })
      : { data: [], error: null };
  if (pagosRes.error) throw pagosRes.error;

  const pagosPorFactura = new Map<string, PagoEstadoCuenta[]>();
  for (const pago of pagosRes.data ?? []) {
    const lista = pagosPorFactura.get(pago.factura_id) ?? [];
    lista.push({
      fecha: pago.fecha,
      metodo: pago.metodo,
      moneda: pago.moneda,
      monto_original: pago.monto_original,
      monto_usd: pago.monto_usd,
      referencia: pago.referencia,
    });
    pagosPorFactura.set(pago.factura_id, lista);
  }

  const facturas: FacturaEstadoCuenta[] = (facturasRes.data ?? []).map((f) => ({
    factura_id: f.id,
    numero_factura: f.numero_factura,
    fecha_emision: f.fecha_emision,
    fecha_vencimiento: f.fecha_vencimiento,
    condicion: f.condicion,
    total_usd: f.total_usd,
    pagado_usd: f.total_pagado_usd,
    saldo_usd: f.saldo_usd,
    estado: f.estado,
    pagos: pagosPorFactura.get(f.id) ?? [],
  }));

  const saldoPendienteTotal = facturas.reduce((acc, f) => acc + f.saldo_usd, 0);

  return {
    empresa: empresaRes.data,
    cliente: clienteRes.data,
    generado_el: fechaHoyISO(),
    facturas,
    saldo_pendiente_total: saldoPendienteTotal,
    rango: rango ?? null,
  };
}

export async function obtenerEstadoCuentaService(
  clienteId: string,
  rango?: RangoEstadoCuenta
): Promise<ActionResult<EstadoCuenta>> {
  try {
    const estado = await obtenerEstadoCuentaRepo(clienteId, rango);
    return okResult(estado);
  } catch (error) {
    return fromPostgresError(error);
  }
}