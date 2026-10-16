import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  AsignacionPago,
  ListarSaldoPendienteInput,
  ListarSaldoPendienteResult,
  ProcesarPagoAsignadoInput,
  ProcesarPagoInput,
  SaldoPendiente,
  UltimoCobro,
} from "./schemas";

type VistaFila = Database["public"]["Views"]["facturas_con_saldo"]["Row"];
type PagoFila = Database["public"]["Tables"]["pagos"]["Row"];

const COLUMNAS_SALDO =
  "id, numero_factura, cliente_id, nombre_juridico, fecha_vencimiento, condicion, dias_credito, total_usd, total_pagado_usd, saldo_usd, estado, dias_mora";

const COLUMNAS_COBRO =
  "id, fecha, metodo, monto_original, moneda, tasa_cambio, monto_usd, referencia, facturas(numero_factura, clientes(nombre_juridico))";

type CobroSeleccion = PagoFila & {
  facturas: {
    numero_factura: string;
    clientes: { nombre_juridico: string };
  };
};

function mapearCobro(fila: CobroSeleccion): UltimoCobro {
  return {
    id: fila.id,
    fecha: fila.fecha,
    cliente_nombre: fila.facturas.clientes.nombre_juridico,
    numero_factura: fila.facturas.numero_factura,
    metodo: fila.metodo,
    moneda: fila.moneda,
    monto_original: fila.monto_original,
    tasa_cambio: fila.tasa_cambio,
    monto_usd: fila.monto_usd,
    referencia: fila.referencia,
  };
}

type SaldoSeleccion = Pick<
  VistaFila,
  | "id"
  | "numero_factura"
  | "cliente_id"
  | "nombre_juridico"
  | "fecha_vencimiento"
  | "condicion"
  | "dias_credito"
  | "total_usd"
  | "total_pagado_usd"
  | "saldo_usd"
  | "estado"
  | "dias_mora"
>;

function mapearSaldo(fila: SaldoSeleccion): SaldoPendiente {
  return {
    factura_id: fila.id,
    numero_factura: fila.numero_factura,
    cliente_id: fila.cliente_id,
    nombre_juridico: fila.nombre_juridico,
    fecha_vencimiento: fila.fecha_vencimiento,
    condicion: fila.condicion,
    dias_credito: fila.dias_credito,
    total_usd: fila.total_usd,
    total_pagado_usd: fila.total_pagado_usd,
    saldo_usd: fila.saldo_usd,
    estado: fila.estado,
    dias_mora: fila.dias_mora,
  };
}

/** Resultado que devuelve la RPC `registrar_pago`. */
export type ResultadoRegistrarPago = {
  pago_id: string;
  factura_id: string;
  monto_usd: number;
  saldo_usd: number;
  estado: string;
};

/** Registra un pago mediante la RPC `registrar_pago` (valida sobrepago y conversión en BD). */
export async function procesarPagoRepo(input: ProcesarPagoInput): Promise<ResultadoRegistrarPago> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("registrar_pago", {
    p_factura_id: input.factura_id,
    p_metodo: input.metodo,
    p_monto: input.monto,
    p_tasa: input.tasa_cambio ?? null,
    p_referencia: input.referencia ?? null,
    p_correo: input.correo ?? null,
    p_fecha: input.fecha ?? null,
  });
  if (error) throw error;
  return data;
}

/** Resultado que devuelve la RPC `registrar_pago_asignado`. */
export type ResultadoRegistrarPagoAsignado = {
  total_usd: number;
  pagos: Array<{
    pago_id: string;
    factura_id: string;
    monto_usd: number;
    saldo_usd: number;
    estado: string;
  }>;
};

/**
 * Registra un pago repartido entre varias facturas de un mismo cliente mediante
 * la RPC `registrar_pago_asignado` (valida saldos, sobrepago y referencia en BD).
 */
export async function procesarPagoAsignadoRepo(
  input: ProcesarPagoAsignadoInput
): Promise<ResultadoRegistrarPagoAsignado> {
  const supabase = await createSupabaseServerClient();
  const asignaciones: AsignacionPago[] = input.asignaciones;
  const { data, error } = await supabase.rpc("registrar_pago_asignado", {
    p_metodo: input.metodo,
    p_tasa: input.tasa_cambio ?? null,
    p_referencia: input.referencia ?? null,
    p_correo: input.correo ?? null,
    p_fecha: input.fecha ?? null,
    p_asignaciones: asignaciones,
  });
  if (error) throw error;
  return data;
}

/** Lista facturas con saldo, priorizando las más atrasadas. */
export async function listarSaldoPendienteRepo(
  input: ListarSaldoPendienteInput
): Promise<ListarSaldoPendienteResult> {
  const supabase = await createSupabaseServerClient();

  // Se muestran TODAS las facturas con saldo (vencidas, por vencer y pendientes),
  // no solo las que la vista etiqueta como "pendiente".
  let consulta = supabase
    .from("facturas_con_saldo")
    .select(COLUMNAS_SALDO, { count: "exact" })
    .gt("saldo_usd", 0.005);

  if (input.cliente_id) consulta = consulta.eq("cliente_id", input.cliente_id);

  const desde = (input.pagina - 1) * input.porPagina;
  const { data, error, count } = await consulta
    .order("dias_mora", { ascending: false })
    .range(desde, desde + input.porPagina - 1);
  if (error) throw error;

  const facturas = (data ?? []).map(mapearSaldo);

  return { facturas, total: count ?? 0 };
}

/** Últimos cobros con nombre del cliente y número de factura. */
export async function ultimosPagosRepo(limite: number): Promise<UltimoCobro[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pagos")
    .select(COLUMNAS_COBRO)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;

  return ((data ?? []) as unknown as CobroSeleccion[]).map(mapearCobro);
}

/** Un cobro con sus datos de cliente y factura (para actualizar la pantalla sin recargar). */
export async function obtenerCobroPorIdRepo(pagoId: string): Promise<UltimoCobro> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pagos")
    .select(COLUMNAS_COBRO)
    .eq("id", pagoId)
    .single();
  if (error) throw error;
  return mapearCobro(data as unknown as CobroSeleccion);
}