/**
 * Escapa un valor de texto para usarlo como operando dentro de un filtro
 * `or=(...)` de PostgREST (por ejemplo `ilike`).
 *
 * PostgREST interpreta `,`, `.`, `(` y `)` como separadores dentro de `or`;
 * por eso el valor se entrecomilla. Dentro de las comillas se escapan la barra
 * invertida y la comilla doble para que un texto arbitrario no rompa el filtro
 * ni inyecte condiciones.
 */
export function escaparFiltroPostgrest(valor: string): string {
  const escapado = valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escapado}"`;
}
