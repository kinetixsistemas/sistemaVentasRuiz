import { round2 } from "@/lib/currency";
import type { SaldoPendiente } from "./schemas";

/** Tolerancia en USD para comparar montos (igual que la usada por la base de datos). */
export const TOLERANCIA_USD = 0.005;

/** Facturas abiertas de un cliente (todas las de la lista pertenecen a clientes con saldo). */
export function facturasDelCliente(
  facturas: SaldoPendiente[],
  clienteId: string
): SaldoPendiente[] {
  return facturas.filter((f) => f.cliente_id === clienteId);
}

/** Deuda total (USD) de un cliente: suma de los saldos de sus facturas abiertas. */
export function deudaTotalCliente(facturas: SaldoPendiente[], clienteId: string): number {
  return round2(
    facturasDelCliente(facturas, clienteId).reduce((acc, f) => acc + f.saldo_usd, 0)
  );
}

/** Monto que excede el saldo de una factura (nunca negativo). */
export function calcularExcedente(montoUsd: number, saldoUsd: number): number {
  return round2(Math.max(0, montoUsd - saldoUsd));
}

export type AsignacionInput = {
  /** Saldo pendiente de la factura destino. */
  saldo_usd: number;
  /** Monto que se desea asignar a esa factura. */
  monto_usd: number;
};

export type ResultadoValidacionAsignacion = {
  valido: boolean;
  /** Suma de los montos asignados (USD). */
  asignado: number;
  /** Lo que falta por asignar para cubrir el excedente (USD). */
  restante: number;
  errores: string[];
};

/**
 * Comprueba que las asignaciones cubran exactamente el excedente y que ninguna
 * supere el saldo de su factura. Se usa tanto en la UI como en los tests.
 */
export function validarAsignaciones(
  excedente: number,
  asignaciones: AsignacionInput[]
): ResultadoValidacionAsignacion {
  const errores: string[] = [];
  let asignado = 0;

  for (const asignacion of asignaciones) {
    if (asignacion.monto_usd < 0) {
      errores.push("Los montos asignados no pueden ser negativos");
    } else if (asignacion.monto_usd > asignacion.saldo_usd + TOLERANCIA_USD) {
      errores.push("El monto asignado supera el saldo de una factura");
    }
    if (asignacion.monto_usd > 0) asignado += asignacion.monto_usd;
  }

  asignado = round2(asignado);
  const restante = round2(Math.max(0, excedente - asignado));
  const completo = excedente - asignado <= TOLERANCIA_USD && asignado - excedente <= TOLERANCIA_USD;

  return {
    valido: errores.length === 0 && completo,
    asignado,
    restante,
    errores: [...new Set(errores)],
  };
}
