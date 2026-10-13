import type {
  CondicionFactura,
  EstadoFactura,
  MetodoPago,
  MonedaPago,
} from "@/types/database";

const formatoUsd = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});

/** Formatea un monto en USD (p. ej. "$1.234,56"). */
export function formatUsd(monto: number): string {
  return formatoUsd.format(monto);
}

/** Formatea una fecha ISO (YYYY-MM-DD) como dd/mm/aaaa, sin saltos de zona horaria. */
export function formatFecha(fechaIso: string): string {
  const fecha = fechaIso.split("T")[0] ?? "";
  const [y, m, d] = fecha.split("-");
  if (!y || !m || !d) return fechaIso;
  return `${d}/${m}/${y}`;
}

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  bs: "Bolívares",
  efectivo: "Efectivo",
  zelle: "Zelle",
  binance: "Binance",
};

export const MONEDA_LABEL: Record<MonedaPago, string> = {
  VES: "Bs",
  USD: "USD",
};

export const CONDICION_LABEL: Record<CondicionFactura, string> = {
  contado: "Contado",
  credito: "Crédito",
};

export const ESTADO_LABEL: Record<EstadoFactura, string> = {
  pagada: "Pagada",
  vencida: "Vencida",
  por_vencer: "Por vencer",
  pendiente: "Pendiente",
};

export function labelMetodoPago(metodo: MetodoPago): string {
  return METODO_PAGO_LABEL[metodo];
}

export function labelMoneda(moneda: MonedaPago): string {
  return MONEDA_LABEL[moneda];
}

export function labelCondicion(condicion: CondicionFactura): string {
  return CONDICION_LABEL[condicion];
}