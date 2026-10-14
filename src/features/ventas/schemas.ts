import { z } from "zod";
import { numeroRequerido } from "@/lib/zod-helpers";
import { montoConDosDecimales, round2 } from "@/lib/currency";
import type { CondicionFactura, EstadoFactura, MetodoPago, MonedaPago } from "@/types/database";

/** Regla centralizada del formato del número de factura de la empresa. */
export const MAX_LONGITUD_NUMERO_FACTURA = 20;

/** Número de factura: obligatorio, alfanumérico con guiones, se normaliza a mayúsculas. */
export const numeroFacturaSchema = z
  .string({ error: "El número de factura es obligatorio" })
  .trim()
  .min(1, "El número de factura es obligatorio")
  .max(
    MAX_LONGITUD_NUMERO_FACTURA,
    `El número de factura no puede superar los ${MAX_LONGITUD_NUMERO_FACTURA} caracteres`
  )
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z0-9-]+$/.test(v), "Solo letras, números y guiones");

const clienteIdSchema = z.string().uuid("Identificador de cliente inválido");
const productoIdSchema = z.string().uuid("Seleccione un producto válido");

/** Ítem de factura: cantidad entera > 0 y precio ≥ 0 (máximo 2 decimales). */
export const itemFacturaSchema = z.object({
  producto_id: productoIdSchema,
  cantidad: numeroRequerido("La cantidad es obligatoria", "La cantidad debe ser un número").pipe(
    z
      .number()
      .int("La cantidad debe ser un número entero")
      .min(1, "La cantidad debe ser mayor a 0")
  ),
  precio_unitario_usd: numeroRequerido(
    "El precio es obligatorio",
    "El precio debe ser un número"
  ).pipe(
    z
      .number()
      .min(0, "El precio no puede ser negativo")
      .refine(
        (v) => montoConDosDecimales(v),
        "El precio admite máximo 2 decimales"
      )
  ),
});

export const crearFacturaSchema = z
  .object({
    cliente_id: clienteIdSchema,
    numero_factura: numeroFacturaSchema,
    condicion: z.enum(["contado", "credito"], "Condición inválida"),
    dias_credito: numeroRequerido(
      "Los días de crédito son obligatorios",
      "Los días de crédito deben ser un número"
    ).pipe(z.number().int("Los días de crédito deben ser un número entero")),
    descuento_usd: numeroRequerido(
      "El descuento es obligatorio",
      "El descuento debe ser un número"
    ).pipe(
      z
        .number()
        .min(0, "El descuento no puede ser negativo")
        .refine((v) => montoConDosDecimales(v), "El descuento admite máximo 2 decimales")
    ),
    items: z.array(itemFacturaSchema).min(1, "Agregue al menos un producto a la factura"),
  })
  .superRefine((factura, ctx) => {
    if (factura.condicion === "contado" && factura.dias_credito !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["dias_credito"],
        message: "En pago de contado los días de crédito deben ser 0",
      });
    }
    if (factura.condicion === "credito" && ![7, 15, 30].includes(factura.dias_credito)) {
      ctx.addIssue({
        code: "custom",
        path: ["dias_credito"],
        message: "Los días de crédito deben ser 7, 15 o 30",
      });
    }
    if (factura.descuento_usd > calcularTotal(factura.items)) {
      ctx.addIssue({
        code: "custom",
        path: ["descuento_usd"],
        message: "El descuento no puede superar el subtotal de la factura",
      });
    }
  });

export const listarFacturasSchema = z.object({
  cliente_id: z.string().uuid("Identificador de cliente inválido").optional(),
  fecha_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional(),
  fecha_hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional(),
  estado: z
    .enum(["pagada", "vencida", "por_vencer", "pendiente", "todas"], "Filtro inválido")
    .default("todas"),
  busqueda: z.string().trim().max(100, "La búsqueda es demasiado larga").optional(),
  limite: z.coerce.number().int().min(1).max(200, "Máximo 200").optional(),
});

export const obtenerFacturaSchema = z.object({
  id: z.string().uuid("Identificador de factura inválido"),
});

/** Período (inclusive) para los KPIs de ventas por mes. */
export const resumenVentasSchema = z
  .object({
    desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  })
  .refine((p) => p.desde <= p.hasta, "El período no es válido");

/**
 * Calcula el total de una factura en USD (solo previsualización).
 * El total oficial SIEMPRE lo calcula la base de datos en la RPC `crear_factura`.
 */
export function calcularTotal(
  items: Array<{ cantidad: number; precio_unitario_usd: number }>
): number {
  const total = items.reduce((acc, item) => acc + item.cantidad * item.precio_unitario_usd, 0);
  return round2(total);
}

export type CrearFacturaInput = z.infer<typeof crearFacturaSchema>;
export type ListarFacturasInput = z.infer<typeof listarFacturasSchema>;
export type ObtenerFacturaInput = z.infer<typeof obtenerFacturaSchema>;
export type ResumenVentasInput = z.infer<typeof resumenVentasSchema>;

/** Fila de la vista facturas_con_saldo (listados de ventas y cobranza). */
export type FacturaConSaldo = {
  id: string;
  numero_factura: string;
  cliente_id: string;
  rif: string;
  nombre_juridico: string;
  vendedor: string;
  fecha_emision: string;
  condicion: CondicionFactura;
  dias_credito: number;
  fecha_vencimiento: string;
  total_usd: number;
  total_pagado_usd: number;
  saldo_usd: number;
  estado: EstadoFactura;
  dias_mora: number;
};

export type ItemFactura = {
  id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario_usd: number;
  subtotal_usd: number;
  producto: { codigo: string; nombre: string } | null;
};

export type PagoFactura = {
  id: string;
  fecha: string;
  metodo: MetodoPago;
  monto_original: number;
  moneda: MonedaPago;
  tasa_cambio: number | null;
  monto_usd: number;
  referencia: string | null;
  correo: string | null;
};

export type FacturaDetalle = {
  id: string;
  numero_factura: string;
  fecha_emision: string;
  condicion: CondicionFactura;
  dias_credito: number;
  fecha_vencimiento: string;
  total_usd: number;
  descuento_usd: number;
  cliente: { id: string; rif: string; nombre_juridico: string };
  items: ItemFactura[];
  pagos: PagoFactura[];
};

/** KPIs de cartera calculados en la BD (RPC `resumen_cartera`). */
export type ResumenCartera = {
  por_cobrar_usd: number;
  facturas_abiertas: number;
  vencidas_usd: number;
  facturas_vencidas: number;
  por_vencer_usd: number;
  facturas_por_vencer: number;
};

/** KPIs de ventas de un período (RPC `resumen_ventas_periodo`). */
export type ResumenVentas = {
  total_vendido_usd: number;
  total_recaudado_usd: number;
};