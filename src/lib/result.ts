/**
 * Contrato de respuesta para Server Actions.
 * Toda mutación/lectura de un módulo devuelve este tipo.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        fieldErrors?: Record<string, string>;
      };
    };

export function okResult<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function errorResult<T>(
  code: string,
  message: string,
  fieldErrors?: Record<string, string>
): ActionResult<T> {
  return { ok: false, error: { code, message, fieldErrors } };
}

type ZodIssueLike = { path?: (string | number)[]; message: string };

/** Convierte los issues de Zod en un mapa campo → mensaje (un mensaje por campo). */
export function fieldErrorsFromZod(error: unknown): Record<string, string> | undefined {
  if (!error || typeof error !== "object") return undefined;

  const candidate = error as { issues?: ZodIssueLike[]; errors?: ZodIssueLike[] };
  const issues = candidate.issues ?? candidate.errors;
  if (!issues) return undefined;

  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path && issue.path.length > 0 ? String(issue.path[0]) : "form";
    if (out[key] === undefined) out[key] = issue.message;
  }
  return out;
}

/** Convierte un error de validación Zod en un ActionResult con errores por campo. */
export function fromZodError<T>(error: unknown): ActionResult<T> {
  return errorResult<T>("VALIDATION", "Revise los campos marcados", fieldErrorsFromZod(error));
}

type PgError = { code?: string; message?: string };

function mensajeDuplicado(message: string): string {
  // Las restricciones unique de las migraciones tienen nombres estables.
  if (message.includes("clientes_rif_key")) return "El RIF ya está registrado";
  if (message.includes("facturas_numero_factura_key"))
    return "Ese número de factura ya existe";
  if (message.includes("productos_codigo_key")) return "El código ya existe";
  return "Ya existe un registro con ese valor único.";
}

/**
 * Traduce errores de Postgres/Supabase a mensajes en español legibles.
 *
 * Nunca se expone el mensaje crudo de la base de datos al usuario: puede ser
 * texto técnico en inglés, contener nombres de tablas/columnas o detalles de
 * infraestructura. Los errores no mapeados se registran y se devuelve un
 * mensaje genérico y accionable.
 */
export function postgresErrorToMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "Ocurrió un error inesperado.";

  const { code, message } = error as PgError;
  const msg = message ?? "";

  switch (code) {
    case "23505":
      return mensajeDuplicado(msg);
    case "23514":
      return "La operación no cumple con las reglas de validación del sistema.";
    case "23503":
      return "No se puede completar la operación porque el registro está relacionado con otros datos.";
    case "23502":
      return "Hay un campo obligatorio sin valor.";
    case "22P02":
      return "Hay un valor con el formato incorrecto (revise números y fechas).";
    // Códigos propios de las RPC (ver migraciones 0003 y 0004). El mensaje ya
    // lo redactan las funciones SQL en español, así que se prefiere.
    case "KX001":
      return msg || "Stock insuficiente para facturar.";
    case "KX002":
      return msg || "Los datos de la factura no son válidos.";
    case "KX003":
      return msg || "El pago no es válido.";
    case "KX004":
      return msg || "El registro no existe.";
    case "KX005":
      return msg || "El producto seleccionado no existe.";
    default:
      return "No se pudo completar la operación. Vuelve a intentarlo.";
  }
}

/** Verdadero cuando Supabase reporta que el registro consultado no existe (PGRST116). */
export function esErrorNoEncontrado(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && (error as { code?: string }).code === "PGRST116"
  );
}

/**
 * Detecta los errores de control de flujo de Next.js (`redirect`, `notFound`,
 * render dinámico). No deben transformarse en `ActionResult`: los services los
 * capturan con `try/catch`, y si se devolvieran como error normal Next no
 * podría redirigir ni marcar la ruta como dinámica. Hay que re-lanzarlos.
 */
export function esErrorDeControlNext(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const digest = (error as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_") || digest === "DYNAMIC_SERVER_USAGE")
  );
}

/** Convierte un error de Postgres/Supabase (o de una RPC) en un ActionResult. */
export function fromPostgresError<T>(error: unknown): ActionResult<T> {
  if (esErrorDeControlNext(error)) throw error;
  const pg = error && typeof error === "object" ? (error as PgError) : undefined;
  const code = pg?.code || "GENERIC";
  return errorResult<T>(code, postgresErrorToMessage(error));
}