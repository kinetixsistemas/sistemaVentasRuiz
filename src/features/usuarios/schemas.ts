import { z } from "zod";
import { textoRequerido } from "@/lib/zod-helpers";
import type { RolUsuario } from "@/types/database";

export const rolUsuarioSchema = z.enum(["admin", "vendedor"], "Rol inválido");

const correoRequeridoSchema = z
  .string({ error: "El correo es obligatorio" })
  .trim()
  .min(1, "El correo es obligatorio")
  .pipe(z.email("El correo debe tener un formato válido"))
  .transform((v) => v.toLowerCase());

const passwordRequeridaSchema = z
  .string({ error: "La contraseña es obligatoria" })
  .min(8, "La contraseña debe tener al menos 8 caracteres");

function vaciaAUndefined(valor: unknown): unknown {
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor === "string" && valor.trim() === "") return undefined;
  return valor;
}

const correoOpcionalSchema = z.preprocess(
  vaciaAUndefined,
  z.union([z.undefined(), correoRequeridoSchema])
);

const passwordOpcionalSchema = z.preprocess(
  vaciaAUndefined,
  z.union([z.undefined(), passwordRequeridaSchema])
);

export const crearUsuarioSchema = z.object({
  nombre: textoRequerido("El nombre es obligatorio", 120),
  correo: correoRequeridoSchema,
  password: passwordRequeridaSchema,
  rol: rolUsuarioSchema,
});

export const actualizarPerfilSchema = z.object({
  nombre: textoRequerido("El nombre es obligatorio", 120),
  correo: correoOpcionalSchema,
  password: passwordOpcionalSchema,
});

export type Perfil = {
  id: string;
  nombre: string | null;
  correo: string | null;
  rol: RolUsuario;
  created_at: string;
};

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;
export type ActualizarPerfilInput = z.infer<typeof actualizarPerfilSchema>;
