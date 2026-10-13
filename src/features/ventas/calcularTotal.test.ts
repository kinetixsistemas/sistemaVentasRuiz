import { describe, expect, it } from "vitest";
import { calcularTotal } from "./schemas";

describe("calcularTotal", () => {
  it("suma cantidad por precio de cada ítem", () => {
    const items = [
      { cantidad: 2, precio_unitario_usd: 10.5 },
      { cantidad: 1, precio_unitario_usd: 5.25 },
    ];
    expect(calcularTotal(items)).toBe(26.25);
  });

  it("redondea el total a 2 decimales", () => {
    const items = [
      { cantidad: 3, precio_unitario_usd: 0.1 },
      { cantidad: 1, precio_unitario_usd: 0.29 },
    ];
    expect(calcularTotal(items)).toBe(0.59);
  });

  it("devuelve 0 para una lista vacía", () => {
    expect(calcularTotal([])).toBe(0);
  });
});