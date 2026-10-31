import { describe, expect, it } from "vitest";
import { actualizarComisionFacturaSchema, crearFacturaSchema } from "./schemas";

const UUID = "00000000-0000-4000-8000-000000000001";

const facturaBase = {
  cliente_id: UUID,
  numero_factura: "F-001",
  condicion: "contado" as const,
  dias_credito: 0,
  descuento_usd: 0,
  modo_manual: true,
  monto_manual_usd: 100,
};

describe("crearFacturaSchema comisión", () => {
  it("permite omitir la comisión para usar la del vendedor", () => {
    expect(crearFacturaSchema.safeParse(facturaBase).success).toBe(true);
  });

  it("acepta porcentaje y monto de comisión juntos", () => {
    const parsed = crearFacturaSchema.safeParse({
      ...facturaBase,
      comision_pct: 7.5,
      comision_usd: 7.5,
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza una comisión con solo porcentaje o solo monto", () => {
    expect(
      crearFacturaSchema.safeParse({ ...facturaBase, comision_pct: 5 }).success
    ).toBe(false);
    expect(
      crearFacturaSchema.safeParse({ ...facturaBase, comision_usd: 5 }).success
    ).toBe(false);
  });

  it("rechaza porcentajes fuera de rango o con más de 2 decimales", () => {
    expect(
      crearFacturaSchema.safeParse({
        ...facturaBase,
        comision_pct: 101,
        comision_usd: 1,
      }).success
    ).toBe(false);
    expect(
      crearFacturaSchema.safeParse({
        ...facturaBase,
        comision_pct: 5.555,
        comision_usd: 5,
      }).success
    ).toBe(false);
  });
});

describe("actualizarComisionFacturaSchema", () => {
  it("acepta una comisión manual válida", () => {
    expect(
      actualizarComisionFacturaSchema.safeParse({
        id: UUID,
        comision_pct: 10,
        comision_usd: 20,
      }).success
    ).toBe(true);
  });

  it("rechaza montos negativos", () => {
    expect(
      actualizarComisionFacturaSchema.safeParse({
        id: UUID,
        comision_pct: 10,
        comision_usd: -1,
      }).success
    ).toBe(false);
  });
});
