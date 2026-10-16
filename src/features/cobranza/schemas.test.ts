import { describe, expect, it } from "vitest";
import { procesarPagoAsignadoSchema, procesarPagoSchema } from "./schemas";

const FACTURA_A = "11111111-1111-4111-8111-111111111111";
const FACTURA_B = "22222222-2222-4222-8222-222222222222";

// La UI siempre envía las claves opcionales (undefined cuando no aplican).
const comunes = {
  tasa_cambio: undefined,
  referencia: undefined,
  correo: undefined,
  fecha: undefined,
};

describe("procesarPagoSchema", () => {
  it("acepta un pago en efectivo sin tasa ni referencia", () => {
    const res = procesarPagoSchema.safeParse({
      ...comunes,
      factura_id: FACTURA_A,
      metodo: "efectivo",
      monto: 10,
    });
    expect(res.success).toBe(true);
  });

  it("exige tasa y referencia en bolívares", () => {
    const sinTasa = procesarPagoSchema.safeParse({
      ...comunes,
      factura_id: FACTURA_A,
      metodo: "bs",
      monto: 100,
      referencia: "123456",
    });
    expect(sinTasa.success).toBe(false);

    const completo = procesarPagoSchema.safeParse({
      ...comunes,
      factura_id: FACTURA_A,
      metodo: "bs",
      monto: 100,
      tasa_cambio: 36.5,
      referencia: "123456",
    });
    expect(completo.success).toBe(true);
  });

  it("exige correo y referencia en zelle/binance", () => {
    const res = procesarPagoSchema.safeParse({
      ...comunes,
      factura_id: FACTURA_A,
      metodo: "zelle",
      monto: 100,
      referencia: "123456",
    });
    expect(res.success).toBe(false);
  });

  it("no admite tasa en métodos que no sean bolívares", () => {
    const res = procesarPagoSchema.safeParse({
      ...comunes,
      factura_id: FACTURA_A,
      metodo: "efectivo",
      monto: 100,
      tasa_cambio: 36.5,
    });
    expect(res.success).toBe(false);
  });
});

describe("procesarPagoAsignadoSchema", () => {
  it("acepta varias facturas con montos positivos", () => {
    const res = procesarPagoAsignadoSchema.safeParse({
      ...comunes,
      metodo: "efectivo",
      asignaciones: [
        { factura_id: FACTURA_A, monto_usd: 40 },
        { factura_id: FACTURA_B, monto_usd: 15 },
      ],
    });
    expect(res.success).toBe(true);
  });

  it("rechaza una lista vacía", () => {
    const res = procesarPagoAsignadoSchema.safeParse({
      ...comunes,
      metodo: "efectivo",
      asignaciones: [],
    });
    expect(res.success).toBe(false);
  });

  it("rechaza la misma factura repetida", () => {
    const res = procesarPagoAsignadoSchema.safeParse({
      ...comunes,
      metodo: "efectivo",
      asignaciones: [
        { factura_id: FACTURA_A, monto_usd: 40 },
        { factura_id: FACTURA_A, monto_usd: 10 },
      ],
    });
    expect(res.success).toBe(false);
  });

  it("aplica las reglas de método (bolívares exige tasa y referencia)", () => {
    const sinTasa = procesarPagoAsignadoSchema.safeParse({
      ...comunes,
      metodo: "bs",
      asignaciones: [{ factura_id: FACTURA_A, monto_usd: 40 }],
      referencia: "123456",
    });
    expect(sinTasa.success).toBe(false);
  });
});
