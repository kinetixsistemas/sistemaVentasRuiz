import { z } from "zod";
import { numeroRequerido } from "@/lib/zod-helpers";
import { montoConDosDecimales } from "@/lib/currency";
import type { CondicionFactura, EstadoFactura, MetodoPago, MonedaPago } from "@/types/database";

/**
 * Métodos de pago: los mismos que define la BD (columna `pagos.metodo`).
 * La BD decide la moneda según el método y valida los campos obligatorios.
 */
export const metodoPagoSchema = z.enum(
  ["bs", "efectivo", "zelle", "binance"],
  "Método de pago inválido"
);

const montoSchema = numeroRequerido("El monto es obligatorio", "El monto debe ser un número").pipe(
  z
    .number()
    .positive("El monto debe ser mayor a 0")
    .refine((v) => montoConDosDecimales(v), "El monto admite máximo 2 decimales")
);

const tasaCambioOpcionalSchema = z.preprocess(
  (valor) => (valor === undefined || valor === null || valor === "" ? undefined : valor),
  z.union([
    z.undefined(),
    z.coerce
      .number({ error: "La tasa de cambio debe ser un número" })
      .finite("La tasa de cambio debe ser un número válido")
      .min(0, "La tasa de cambio no puede ser negativa")
      .refine((v) => montoConDosDecimales(v), "La tasa de cambio admite máximo 2 decimales"),
  ])
);

const referenciaOpcionalSchema = z.preprocess(
  (valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor),
  z.union([
    z.undefined(),
    z.string().trim().max(100, "La referencia no puede superar 100 caracteres"),
  ])
);

const correoOpcionalSchema = z.preprocess(
  (valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor),
  z.union([z.undefined(), z.email("El formato del correo es inválido")])
);

const fechaOpcionalSchema = z.union([
  z.undefined(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
]);

export const procesarPagoSchema = z
  .object({
    factura_id: z.string().uuid("Identificador de factura inválido"),
    metodo: metodoPagoSchema,
    monto: montoSchema,
    tasa_cambio: tasaCambioOpcionalSchema,
    referencia: referenciaOpcionalSchema,
    correo: correoOpcionalSchema,
    fecha: fechaOpcionalSchema,
  })
  .superRefine((pago, ctx) => {
    const bs = pago.metodo === "bs";
    const trasferenciaDigital = pago.metodo === "zelle" || pago.metodo === "binance";

    if (bs) {
      if (pago.tasa_cambio === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["tasa_cambio"],
          message: "La tasa de cambio es obligatoria para pagos en bolívares",
        });
      } else if (pago.tasa_cambio <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["tasa_cambio"],
          message: "La tasa de cambio debe ser mayor a 0",
        });
      }
      if (pago.referencia === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["referencia"],
          message: "La referencia es obligatoria para pagos en bolívares",
        });
      }
    } else if (pago.tasa_cambio !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["tasa_cambio"],
        message: "No se admite tasa de cambio para este método de pago",
      });
    }

    if (trasferenciaDigital) {
      if (pago.correo === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["correo"],
          message: "El correo es obligatorio para este método de pago",
        });
      }
      if (pago.referencia === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["referencia"],
          message: "La referencia es obligatoria para este método de pago",
        });
      }
    }
  });

export const listarSaldoPendienteSchema = z.object({
  cliente_id: z.string().uuid("Identificador de cliente inválido").optional(),
  pagina: z.coerce.number().int().min(1, "Página inválida").default(1),
  porPagina: z.coerce.number().int().min(1).max(100, "Máximo 100 por página").default(20),
});

export const ultimosPagosSchema = z.object({
  limite: z.coerce.number().int().min(1, "Límite inválido").max(50, "Máximo 50").default(10),
});

/** Resumen de una factura con saldo pendiente (desde la vista). */
export type SaldoPendiente = {
  factura_id: string;
  numero_factura: string;
  fecha_vencimiento: string;
  condicion: CondicionFactura;
  dias_credito: number;
  total_usd: number;
  total_pagado_usd: number;
  saldo_usd: number;
  estado: EstadoFactura;
  dias_mora: number;
};

export type ListarSaldoPendienteResult = {
  facturas: SaldoPendiente[];
  total: number;
};

/** Último cobro registrado (para la pantalla de cobranza). */
export type UltimoCobro = {
  id: string;
  fecha: string;
  cliente_nombre: string;
  numero_factura: string;
  metodo: MetodoPago;
  moneda: MonedaPago;
  monto_original: number;
  tasa_cambio: number | null;
  monto_usd: number;
  referencia: string | null;
};

export type ProcesarPagoInput = z.infer<typeof procesarPagoSchema>;
export type ListarSaldoPendienteInput = z.infer<typeof listarSaldoPendienteSchema>;

/**
 * Resultado de registrar un pago: el cobro recién creado y los datos de saldo
 * necesarios para actualizar la pantalla sin volver a consultar la lista.
 */
export type PagoRegistrado = {
  pago: UltimoCobro;
  factura_id: string;
  monto_usd: number;
  saldo_usd: number;
};