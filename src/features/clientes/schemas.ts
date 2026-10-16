import { z } from "zod";

/**
 * RIF: se acepta con o sin guiones y en cualquier capitalización.
 * Normaliza a formato canónico J-12345678-9 (letras permitidas: J, G, V, E, P, C).
 */
export const rifClienteSchema = z
  .string({ error: "El RIF es obligatorio" })
  .trim()
  .transform((v) => v.toUpperCase().replace(/\s+/g, ""))
  .refine(
    (v) => /^[JVEGPC][-]?\d{8}[-]?\d$/.test(v),
    "RIF inválido. Formato: J-12345678-9"
  )
  .transform((v) => {
    const letra = v.charAt(0);
    const digitos = v.replace(/\D/g, "");
    return `${letra}-${digitos.slice(0, 8)}-${digitos.slice(8)}`;
  });

/** Nombre jurídico: letras, números y signos comunes (., & -). */
export const nombreJuridicoSchema = z
  .string({ error: "El nombre jurídico es obligatorio" })
  .trim()
  .min(1, "El nombre jurídico es obligatorio")
  .max(200, "Máximo 200 caracteres")
  .refine(
    (v) => /^[A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ .,&'ºª\-]+$/.test(v),
    "Caracteres no permitidos en el nombre jurídico"
  );

/** Nombres de personas: solo letras (tildes, ñ), espacios y apóstrofes. */
function nombreSoloLetras(campo: string, max: number) {
  return z
    .string({ error: `${campo} es obligatorio` })
    .trim()
    .min(1, `${campo} es obligatorio`)
    .max(max, `Máximo ${max} caracteres`)
    .refine(
      (v) => /^[A-Za-záéíóúüñÁÉÍÓÚÜÑ ']+$/.test(v),
      `${campo} solo puede contener letras, espacios y apóstrofes`
    );
}

export const nombreEncargadoSchema = nombreSoloLetras("El nombre del encargado", 120);
export const vendedorSchema = nombreSoloLetras("El vendedor", 120);

/** Teléfono: se eliminan +, espacios y guiones; quedan 10 a 13 dígitos. */
export const telefonoSchema = z
  .string({ error: "El teléfono es obligatorio" })
  .trim()
  .min(1, "El teléfono es obligatorio")
  .transform((v) => v.replace(/[^0-9]/g, ""))
  .refine(
    (v) => /^[0-9]{10,13}$/.test(v),
    "El teléfono debe tener entre 10 y 13 dígitos"
  );

/** Correo: formato válido y en minúsculas. */
export const correoSchema = z
  .string({ error: "El correo es obligatorio" })
  .trim()
  .min(1, "El correo es obligatorio")
  .pipe(z.email("El correo debe tener un formato válido"))
  .transform((v) => v.toLowerCase());

export const direccionSchema = z
  .string({ error: "La dirección es obligatoria" })
  .trim()
  .min(5, "La dirección debe tener al menos 5 caracteres")
  .max(500, "Máximo 500 caracteres");

export const crearClienteSchema = z.object({
  rif: rifClienteSchema,
  nombre_juridico: nombreJuridicoSchema,
  nombre_encargado: nombreEncargadoSchema,
  telefono: telefonoSchema,
  correo: correoSchema,
  direccion: direccionSchema,
  vendedor: vendedorSchema,
});

export const actualizarClienteSchema = z.object({
  id: z.string().uuid("Identificador de cliente inválido"),
  ...crearClienteSchema.shape,
});

export const listarClientesSchema = z.object({
  busqueda: z.string().trim().max(60, "Búsqueda demasiado larga").optional(),
  pagina: z.coerce.number().int().min(1, "Página inválida").default(1),
  porPagina: z.coerce.number().int().min(1).max(100, "Máximo 100 por página").default(20),
});

export type Cliente = {
  id: string;
  rif: string;
  nombre_juridico: string;
  nombre_encargado: string;
  telefono: string;
  correo: string;
  direccion: string;
  vendedor: string;
};

/** Cliente con el número de facturas abiertas, para el listado principal. */
export type ClienteConCartera = Cliente & { facturas_pendientes: number };

export type CrearClienteInput = z.infer<typeof crearClienteSchema>;
export type ActualizarClienteInput = z.infer<typeof actualizarClienteSchema>;
export type ListarClientesInput = z.infer<typeof listarClientesSchema>;
export type ListarClientesResult = { clientes: ClienteConCartera[]; total: number };