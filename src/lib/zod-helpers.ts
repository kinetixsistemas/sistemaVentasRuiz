import { z } from "zod";

/**
 * Acepta un número o una cadena numérica (lo que envían los formularios).
 * Rechaza cadenas vacías, letras y valores que no sean números.
 * Devuelve un schema cuyo OUTPUT es `number`.
 */
export function numeroRequerido(msgObligatorio: string, msgNumero: string) {
  return z.union([
    z.number(),
    z
      .string()
      .trim()
      .min(1, msgObligatorio)
      .pipe(z.coerce.number({ error: msgNumero })),
  ]);
}

/** Texto obligatorio con longitud máxima. */
export function textoRequerido(msg: string, max: number) {
  return z
    .string({ error: msg })
    .trim()
    .min(1, msg)
    .max(max, `Máximo ${max} caracteres`);
}

/** Nombres de personas: solo letras (tildes, ñ), espacios y apóstrofes. */
export function nombreSoloLetras(campo: string, max: number) {
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