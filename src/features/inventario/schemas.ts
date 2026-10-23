import { z } from "zod";
import { numeroRequerido, textoRequerido } from "@/lib/zod-helpers";
import { montoConDosDecimales } from "@/lib/currency";

/** Código de producto: se normaliza a mayúsculas, solo letras/números/guiones. */
export const codigoProductoSchema = z
  .string({ error: "El código es obligatorio" })
  .trim()
  .min(1, "El código es obligatorio")
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z0-9-]+$/.test(v), "Solo letras, números y guiones (sin espacios)");

export const nombreProductoSchema = textoRequerido("El nombre es obligatorio", 120);

/** Cantidad: entero ≥ 0 (rechaza letras, decimales y negativos). */
export const cantidadProductoSchema = numeroRequerido(
  "La cantidad es obligatoria",
  "La cantidad debe ser un número"
).pipe(
  z
    .number()
    .int("La cantidad debe ser un número entero")
    .min(0, "La cantidad no puede ser negativa")
);

/** Precio en USD: ≥ 0 con máximo 2 decimales. */
export const precioProductoSchema = numeroRequerido(
  "El precio es obligatorio",
  "El precio debe ser un número"
).pipe(
  z
    .number()
    .min(0, "El precio no puede ser negativo")
    .refine((v) => montoConDosDecimales(v), "El precio admite máximo 2 decimales")
);

export const categoriaIdSchema = z
  .string()
  .uuid("Identificador de categoría inválido")
  .nullable()
  .optional();

export const nombreCategoriaSchema = textoRequerido(
  "El nombre de la categoría es obligatorio",
  60
);

export const crearCategoriaSchema = z.object({
  nombre: nombreCategoriaSchema,
});

export const existenciaFiltroSchema = z.enum(["todo", "con", "sin"]).default("todo");

/** Filtro por categoría: `null` = todas, uuid = esa categoría, "sin" = sin categoría. */
export const categoriaFiltroSchema = z
  .union([z.literal("sin"), z.string().uuid("Identificador de categoría inválido"), z.null()])
  .catch(null);

export const crearProductoSchema = z.object({
  codigo: codigoProductoSchema,
  nombre: nombreProductoSchema,
  cantidad: cantidadProductoSchema,
  precio_usd: precioProductoSchema,
  categoria_id: categoriaIdSchema,
});

export const actualizarProductoSchema = z.object({
  id: z.string().uuid("Identificador de producto inválido"),
  codigo: codigoProductoSchema,
  nombre: nombreProductoSchema,
  cantidad: cantidadProductoSchema,
  precio_usd: precioProductoSchema,
  categoria_id: categoriaIdSchema,
});

export const listarProductosSchema = z.object({
  busqueda: z.string().trim().max(60, "Búsqueda demasiado larga").optional(),
  existencia: existenciaFiltroSchema,
  categoria: categoriaFiltroSchema.optional(),
  pagina: z.coerce.number().int().min(1, "Página inválida").default(1),
  porPagina: z.coerce.number().int().min(1).max(100, "Máximo 100 por página").default(20),
});

export const sugerenciasProductosSchema = z.object({
  busqueda: z.string().trim().min(1, "Escribe algo para buscar").max(60, "Búsqueda demasiado larga"),
  limite: z.coerce.number().int().min(1).max(10, "Máximo 10").default(6),
});

export const listarStockBajoSchema = z.object({
  umbral: z.coerce.number().int().min(0, "Umbral inválido").default(5),
  limite: z.coerce.number().int().min(1).max(100, "Máximo 100").default(6),
});

export type Categoria = {
  id: string;
  nombre: string;
};

export type ExistenciaFiltro = z.infer<typeof existenciaFiltroSchema>;
/** `null` = todas las categorías; uuid = una categoría concreta. */
export type CategoriaFiltro = z.infer<typeof categoriaFiltroSchema>;

export type Producto = {
  id: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  precio_usd: number;
  foto_url: string | null;
  categoria_id: string | null;
};

/** Sugerencia de búsqueda (código o nombre) para autocompletar. */
export type SugerenciaProducto = {
  id: string;
  codigo: string;
  nombre: string;
  cantidad: number;
};

export type CrearProductoInput = z.infer<typeof crearProductoSchema>;
export type ActualizarProductoInput = z.infer<typeof actualizarProductoSchema>;
export type ListarProductosInput = z.infer<typeof listarProductosSchema>;
export type ListarCategoriaInput = z.infer<typeof crearCategoriaSchema>;
export type SugerenciasProductosInput = z.infer<typeof sugerenciasProductosSchema>;
export type ListarProductosResult = { productos: Producto[]; total: number };