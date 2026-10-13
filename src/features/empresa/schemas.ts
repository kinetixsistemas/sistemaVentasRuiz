import { z } from "zod";
import { numeroRequerido, textoRequerido } from "@/lib/zod-helpers";

/**
 * RIF: se acepta con o sin guiones y en cualquier capitalización.
 * Normaliza a formato canónico J-12345678-9 (letras permitidas: J, G, V, E, P, C).
 */
export const rifEmpresaSchema = z
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

/** Teléfono: se eliminan +, espacios y guiones; quedan 10 a 13 dígitos. */
export const telefonoEmpresaSchema = z
  .string({ error: "El teléfono es obligatorio" })
  .trim()
  .min(1, "El teléfono es obligatorio")
  .transform((v) => v.replace(/[^0-9]/g, ""))
  .refine(
    (v) => /^[0-9]{10,13}$/.test(v),
    "El teléfono debe tener entre 10 y 13 dígitos"
  );

/** Correo: formato válido y en minúsculas. */
export const correoEmpresaSchema = z
  .string({ error: "El correo es obligatorio" })
  .trim()
  .min(1, "El correo es obligatorio")
  .pipe(z.email("El correo debe tener un formato válido"))
  .transform((v) => v.toLowerCase());

/** Convierte cadena vacía o nula en `undefined` antes de validar el campo. */
function vaciaAUndefined(valor: unknown): unknown {
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor === "string" && valor.trim() === "") return undefined;
  return valor;
}

const rifOpcionalSchema = z.preprocess(
  vaciaAUndefined,
  z.union([z.undefined(), rifEmpresaSchema])
);

const telefonoOpcionalSchema = z.preprocess(
  vaciaAUndefined,
  z.union([z.undefined(), telefonoEmpresaSchema])
);

const correoOpcionalSchema = z.preprocess(
  vaciaAUndefined,
  z.union([z.undefined(), correoEmpresaSchema])
);

const textoOpcionalSchema = z.preprocess(
  vaciaAUndefined,
  z.union([
    z.undefined(),
    z
      .string()
      .trim()
      .max(500, "Máximo 500 caracteres"),
  ])
);

export const nombreComercialSchema = textoRequerido("El nombre comercial es obligatorio", 200);

/** Umbral de stock bajo: entero ≥ 0; si falta, se usa 5. */
export const stockBajoUmbralSchema = z.preprocess(
  (valor) => (vaciaAUndefined(valor) === undefined ? 5 : valor),
  numeroRequerido("El umbral es obligatorio", "El umbral debe ser un número").pipe(
    z
      .number()
      .int("El umbral debe ser un número entero")
      .min(0, "El umbral no puede ser negativo")
  )
);

const camposEmpresa = {
  nombre_comercial: nombreComercialSchema,
  razon_social: textoOpcionalSchema,
  rif: rifOpcionalSchema,
  telefono: telefonoOpcionalSchema,
  correo: correoOpcionalSchema,
  direccion: textoOpcionalSchema,
  stock_bajo_umbral: stockBajoUmbralSchema,
};

export const empresaSchema = z.object(camposEmpresa);
export const actualizarEmpresaSchema = empresaSchema;

export type Empresa = {
  id: number;
  nombre_comercial: string;
  razon_social: string | null;
  rif: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  logo_url: string | null;
  stock_bajo_umbral: number;
};

export type ActualizarEmpresaInput = z.infer<typeof actualizarEmpresaSchema>;

/**
 * Subconjunto visible sin autenticar (pantalla de login).
 * Solo la marca: nombre comercial, razón social y logotipo.
 */
export type EmpresaBranding = {
  nombre_comercial: string;
  razon_social: string | null;
  logo_url: string | null;
};
