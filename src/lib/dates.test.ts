import { describe, expect, it } from "vitest";
import {
  fechaHoyISO,
  fechaISO,
  fechaVencimiento,
  hoyCaracas,
  periodoDelMes,
  sumarDias,
} from "./dates";

describe("fechas en America/Caracas", () => {
  it("fechaHoyISO devuelve YYYY-MM-DD", () => {
    expect(fechaHoyISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("hoyCaracas es la medianoche local correspondiente a hoy", () => {
    const hoy = hoyCaracas();
    const iso = fechaISO(hoy);
    expect(iso).toBe(fechaHoyISO());
    expect(Number(iso.slice(8, 10))).toBe(hoy.getDate());
  });
});

describe("sumarDias", () => {
  it("suma días dentro del mismo mes", () => {
    expect(sumarDias("2026-01-15", 7)).toBe("2026-01-22");
  });

  it("cruza el límite de mes", () => {
    expect(sumarDias("2026-01-28", 7)).toBe("2026-02-04");
  });

  it("cruza el límite de año", () => {
    expect(sumarDias("2026-12-30", 5)).toBe("2027-01-04");
  });

  it("respeta los años bisiestos", () => {
    expect(sumarDias("2024-02-28", 1)).toBe("2024-02-29");
    expect(sumarDias("2025-02-28", 1)).toBe("2025-03-01");
  });

  it("suma cero días sin cambiar la fecha", () => {
    expect(sumarDias("2026-03-01", 0)).toBe("2026-03-01");
  });

  it("rechaza formatos inválidos", () => {
    expect(() => sumarDias("15-01-2026", 1)).toThrow();
    expect(() => sumarDias("2026-13-01", 1)).toThrow();
  });
});

describe("fechaVencimiento", () => {
  it("calcula el vencimiento sumando los días de crédito", () => {
    expect(fechaVencimiento("2026-02-01", 15)).toBe("2026-02-16");
    expect(fechaVencimiento("2026-02-01", 30)).toBe("2026-03-03");
    expect(fechaVencimiento("2026-02-01", 0)).toBe("2026-02-01");
  });
});

describe("periodoDelMes", () => {
  it("devuelve el primer y último día del mes", () => {
    expect(periodoDelMes(new Date(2026, 9, 13))).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" });
  });

  it("respeta los meses de 30 días y febrero", () => {
    expect(periodoDelMes(new Date(2026, 3, 5))).toEqual({ desde: "2026-04-01", hasta: "2026-04-30" });
    expect(periodoDelMes(new Date(2026, 1, 5))).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
  });

  it("usa los años bisiestos", () => {
    expect(periodoDelMes(new Date(2024, 1, 5))).toEqual({ desde: "2024-02-01", hasta: "2024-02-29" });
  });

  it("sin argumentos usa el mes actual en Caracas", () => {
    const periodo = periodoDelMes();
    const hoy = fechaHoyISO();
    expect(periodo.desde.slice(0, 7)).toBe(hoy.slice(0, 7));
    expect(periodo.desde.endsWith("-01")).toBe(true);
  });
});