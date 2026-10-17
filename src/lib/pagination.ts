/** Tamaño de página por defecto en los listados paginados. */
export const POR_PAGINA = 20;

/** Normaliza el parámetro `pagina` de la URL (1-based). */
export function numeroPagina(valor: string | string[] | undefined): number {
  const raw = Array.isArray(valor) ? valor[0] : valor;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** Total de páginas para un listado, nunca menor que 1. */
export function totalPaginas(total: number, porPagina: number = POR_PAGINA): number {
  return Math.max(1, Math.ceil(total / porPagina));
}

/** Rango de fechas (inclusive) leído de la URL. */
export function rangoDeUrl(
  desde: string | string[] | undefined,
  hasta: string | string[] | undefined
): { desde: string; hasta: string } {
  const d = Array.isArray(desde) ? desde[0] : desde;
  const h = Array.isArray(hasta) ? hasta[0] : hasta;
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const valido = (v: string | undefined): v is string => typeof v === "string" && re.test(v);
  return { desde: valido(d) ? d : "", hasta: valido(h) ? h : "" };
}
