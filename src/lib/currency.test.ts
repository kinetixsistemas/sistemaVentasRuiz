import { describe, expect, it } from "vitest";
import { bsToUsd, esMontoValido, montoConDosDecimales, round2 } from "./currency";

describe("round2", () => {
  it("redondea correctamente a 2 decimales", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(10)).toBe(10);
    expect(round2(88.5)).toBe(88.5);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(2.3612)).toBe(2.36);
  });
});

describe("bsToUsd", () => {
  it("convierte bolívares a USD con la tasa del día", () => {
    expect(bsToUsd(5000, 50)).toBe(100);
    expect(bsToUsd(100, 42.35)).toBe(2.36);
    expect(bsToUsd(255.5, 42.35)).toBe(6.03);
    expect(bsToUsd(0, 50)).toBe(0);
  });

  it("devuelve NaN si la tasa no es válida", () => {
    expect(bsToUsd(100, 0)).toBeNaN();
    expect(bsToUsd(100, -5)).toBeNaN();
    expect(bsToUsd(100, Number.NaN)).toBeNaN();
  });
});

describe("montoConDosDecimales", () => {
  it("acepta números con hasta 2 decimales", () => {
    expect(montoConDosDecimales(12.34)).toBe(true);
    expect(montoConDosDecimales(12)).toBe(true);
    expect(montoConDosDecimales(0)).toBe(true);
    expect(montoConDosDecimales(12.3)).toBe(true);
  });

  it("rechaza más de 2 decimales y no-números", () => {
    expect(montoConDosDecimales(12.345)).toBe(false);
    expect(montoConDosDecimales("12")).toBe(false);
    expect(montoConDosDecimales(Number.NaN)).toBe(false);
    expect(montoConDosDecimales(null)).toBe(false);
  });
});

describe("esMontoValido", () => {
  it("acepta montos ≥ 0 con máximo 2 decimales", () => {
    expect(esMontoValido(0)).toBe(true);
    expect(esMontoValido(9.5)).toBe(true);
    expect(esMontoValido(100.01)).toBe(true);
  });

  it("rechaza montos negativos o con más de 2 decimales", () => {
    expect(esMontoValido(-1)).toBe(false);
    expect(esMontoValido(1.999)).toBe(false);
  });
});