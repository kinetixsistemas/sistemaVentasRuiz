/**
 * Utilidades de moneda. El dinero se trabaja en USD con 2 decimales; la
 * validación final de montos vive en la base de datos (numeric(12,2) + CHECK).
 * En JS se redondea de forma consistente para evitar errores de punto flotante.
 */

/** Redondea a 2 decimales (88.5 → 88.5, 1.005 → 1.01). */
export function round2(monto: number): number {
  return Math.round((monto + Number.EPSILON) * 100) / 100;
}

/**
 * Convierte bolívares a USD usando la tasa recibida.
 * `monto_usd = monto_bs / tasa`. Devuelve NaN si la tasa no es válida.
 */
export function bsToUsd(montoBs: number, tasa: number): number {
  if (!Number.isFinite(montoBs) || !Number.isFinite(tasa) || tasa <= 0) return NaN;
  return round2(montoBs / tasa);
}

/** Verifica que un valor sea un número con máximo 2 decimales. */
export function montoConDosDecimales(valor: unknown): valor is number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return false;
  return Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6;
}

/** Verifica que un valor sea un monto válido: número, máximo 2 decimales y ≥ 0. */
export function esMontoValido(valor: unknown): valor is number {
  return montoConDosDecimales(valor) && valor >= 0;
}