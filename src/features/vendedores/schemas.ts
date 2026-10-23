import { z } from "zod";
import type { EstadoFactura } from "@/types/database";
import { nombreSoloLetras } from "@/lib/zod-helpers";

export const nombreVendedorSchema = nombreSoloLetras("El nombre", 120);

/** Comisión 0–100 con máximo dos decimales. Acepta vacío como 0. */
export const comisionPctSchema = z
  .preprocess(
    (valor) => {
      if (valor === "" || valor === null || valor === undefined) return 0;
      if (typeof valor === "string") return valor.trim().replace(",", ".");
      return valor;
    },
    z.coerce
      .number({ error: "La comisión debe ser un número" })
      .min(0, "La comisión no puede ser negativa")
      .max(100, "La comisión no puede superar 100")
  )
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9, "Máximo 2 decimales");

const metodosPagoComision = ["bs", "efectivo", "zelle", "binance"] as const;

export const crearVendedorSchema = z.object({
  nombre: nombreVendedorSchema,
  comision_pct: comisionPctSchema,
  activo: z.boolean().default(true),
});

export const actualizarVendedorSchema = z.object({
  id: z.string().uuid("Identificador de vendedor inválido"),
  ...crearVendedorSchema.shape,
});

function esFechaISOValida(valor: string): boolean {
  const [anio, mes, dia] = valor.split("-").map(Number);
  if (!anio || !mes || !dia) return false;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

const fechaOpcionalSchema = z.preprocess(
  (valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .refine(esFechaISOValida, "Fecha inválida")
    .optional()
);

export const resumenVendedoresSchema = z
  .object({
    desde: fechaOpcionalSchema,
    hasta: fechaOpcionalSchema,
  })
  .refine((v) => !(v.desde && v.hasta) || v.desde <= v.hasta, {
    message: "El rango de fechas no es válido",
    path: ["hasta"],
  });

export const historialVendedorSchema = z.object({
  vendedor_id: z.string().uuid("Identificador de vendedor inválido"),
  pagina: z.coerce.number().int().min(1, "Página inválida").default(1),
  porPagina: z.coerce.number().int().min(1).max(50, "Máximo 50 por página").default(10),
});

export const pagarComisionVendedorSchema = z
  .object({
    factura_id: z.string().uuid("Identificador de factura inválido"),
    comision_pct: comisionPctSchema.refine((n) => n > 0, "Ingresa un porcentaje mayor a 0"),
    metodo: z.enum(metodosPagoComision, { error: "Método de pago inválido" }),
    monto: z.coerce
      .number({ error: "El monto debe ser un número" })
      .gt(0, "El monto debe ser mayor a 0"),
    tasa_cambio: z.coerce.number().positive("La tasa debe ser mayor a 0").optional(),
    referencia: z
      .string()
      .transform((v) => v.trim())
      .optional(),
    correo: z
      .string()
      .transform((v) => v.trim())
      .optional(),
    fecha: z.string().optional(),
  })
  .superRefine((pago, ctx) => {
    const bs = pago.metodo === "bs";
    const transferenciaDigital = pago.metodo === "zelle" || pago.metodo === "binance";

    if (bs) {
      if (pago.tasa_cambio === undefined || pago.tasa_cambio === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tasa_cambio"],
          message: "La tasa de cambio es obligatoria para pagos en bolívares",
        });
      }
      if (!pago.referencia) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["referencia"],
          message: "La referencia es obligatoria para pagos en bolívares",
        });
      }
    } else if (pago.tasa_cambio !== undefined && pago.tasa_cambio !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tasa_cambio"],
        message: "No se admite tasa de cambio para este método de pago",
      });
    }

    if (transferenciaDigital) {
      if (!pago.correo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["correo"],
          message: "El correo es obligatorio para este método de pago",
        });
      }
      if (!pago.referencia) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["referencia"],
          message: "La referencia es obligatoria para este método de pago",
        });
      }
    }
  });

export type Vendedor = {
  id: string;
  nombre: string;
  comision_pct: number;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

/** Fila del RPC `resumen_vendedores`. */
export type VendedorResumen = Vendedor & {
  facturas_periodo: number;
  pagadas_periodo: number;
  pendientes_periodo: number;
  vendido_periodo_usd: number;
  cobrado_periodo_usd: number;
  saldo_periodo_usd: number;
  facturas_total: number;
  pagadas_total: number;
  vendido_total_usd: number;
  comision_total_usd: number;
  comision_pagada_usd: number;
  comision_pendiente_usd: number;
  comisiones_pagadas: number;
};

/** Comisión pagada registrada para una factura. */
export type ComisionVendedor = {
  id: string;
  factura_id: string;
  vendedor_id: string;
  base_usd: number;
  comision_pct: number;
  monto_usd: number;
  pagada_at: string;
  fecha: string;
  metodo: string;
  moneda: string;
  monto_original: number;
  tasa_cambio: number | null;
  referencia: string | null;
  correo: string | null;
};

/** Factura del historial de un vendedor, con su comisión si ya fue pagada. */
export type FacturaVendedor = {
  factura_id: string;
  numero_factura: string;
  nombre_juridico: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  total_usd: number;
  total_pagado_usd: number;
  saldo_usd: number;
  estado: EstadoFactura;
  dias_mora: number;
  comision: ComisionVendedor | null;
};

export type HistorialVendedorResult = {
  facturas: FacturaVendedor[];
  total: number;
};

export type CrearVendedorInput = z.infer<typeof crearVendedorSchema>;
export type ActualizarVendedorInput = z.infer<typeof actualizarVendedorSchema>;
export type ResumenVendedoresInput = z.infer<typeof resumenVendedoresSchema>;
export type HistorialVendedorInput = z.infer<typeof historialVendedorSchema>;
export type PagarComisionVendedorInput = z.infer<typeof pagarComisionVendedorSchema>;
