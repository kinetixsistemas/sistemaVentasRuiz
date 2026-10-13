/**
 * Utilidades de fechas. "Hoy" siempre se calcula en la zona horaria
 * America/Caracas para que los vencimientos y días de mora coincidan con la BD.
 */

const TIME_ZONE = "America/Caracas";

/** Fecha de hoy (a medianoche local) según el calendario de America/Caracas. */
export function hoyCaracas(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [year, month, day] = parts.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

/** Fecha de hoy como texto ISO (YYYY-MM-DD) en America/Caracas. */
export function fechaHoyISO(): string {
  return fechaISO(hoyCaracas());
}

/** Formatea un Date como YYYY-MM-DD. */
export function fechaISO(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Suma días a una fecha ISO (YYYY-MM-DD) sin efectos de zona horaria. */
export function sumarDias(fechaIso: string, dias: number): string {
  const [year, month, day] = fechaIso.split("-").map(Number);
  if (!year || !month || !day || month > 12 || day > 31) {
    throw new Error("Formato de fecha inválido: se esperaba YYYY-MM-DD");
  }
  const fecha = new Date(Date.UTC(year, month - 1, day));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/** Calcula la fecha de vencimiento sumando los días de crédito a la emisión. */
export function fechaVencimiento(fechaEmisionIso: string, diasCredito: number): string {
  return sumarDias(fechaEmisionIso, diasCredito);
}