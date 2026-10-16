import { describe, expect, it } from "vitest";
import {
  calcularExcedente,
  deudaTotalCliente,
  facturasDelCliente,
  validarAsignaciones,
} from "./asignacion";
import type { SaldoPendiente } from "./schemas";

function factura(parcial: Partial<SaldoPendiente>): SaldoPendiente {
  return {
    factura_id: parcial.factura_id ?? "00000000-0000-4000-8000-000000000001",
    numero_factura: parcial.numero_factura ?? "F-1",
    cliente_id: parcial.cliente_id ?? "11111111-1111-4111-8111-111111111111",
    nombre_juridico: parcial.nombre_juridico ?? "Cliente",
    fecha_vencimiento: parcial.fecha_vencimiento ?? "2026-01-01",
    condicion: parcial.condicion ?? "credito",
    dias_credito: parcial.dias_credito ?? 30,
    total_usd: parcial.total_usd ?? 100,
    total_pagado_usd: parcial.total_pagado_usd ?? 0,
    saldo_usd: parcial.saldo_usd ?? 100,
    estado: parcial.estado ?? "pendiente",
    dias_mora: parcial.dias_mora ?? 0,
  };
}

describe("calcularExcedente", () => {
  it("devuelve la diferencia cuando el monto supera el saldo", () => {
    expect(calcularExcedente(100, 60)).toBe(40);
  });

  it("devuelve 0 cuando el monto no supera el saldo", () => {
    expect(calcularExcedente(50, 60)).toBe(0);
    expect(calcularExcedente(60, 60)).toBe(0);
  });
});

describe("facturasDelCliente / deudaTotalCliente", () => {
  const facturas = [
    factura({ factura_id: "a", cliente_id: "cli-1", saldo_usd: 30 }),
    factura({ factura_id: "b", cliente_id: "cli-1", saldo_usd: 70 }),
    factura({ factura_id: "c", cliente_id: "cli-2", saldo_usd: 500 }),
  ];

  it("filtra las facturas de un cliente", () => {
    expect(facturasDelCliente(facturas, "cli-1").map((f) => f.factura_id)).toEqual(["a", "b"]);
  });

  it("suma los saldos del cliente", () => {
    expect(deudaTotalCliente(facturas, "cli-1")).toBe(100);
    expect(deudaTotalCliente(facturas, "cli-2")).toBe(500);
    expect(deudaTotalCliente(facturas, "cli-3")).toBe(0);
  });
});

describe("validarAsignaciones", () => {
  it("es válido cuando cubre exactamente el excedente", () => {
    const res = validarAsignaciones(40, [
      { saldo_usd: 30, monto_usd: 10 },
      { saldo_usd: 70, monto_usd: 30 },
    ]);
    expect(res.valido).toBe(true);
    expect(res.asignado).toBe(40);
    expect(res.restante).toBe(0);
  });

  it("es inválido si falta por asignar", () => {
    const res = validarAsignaciones(40, [{ saldo_usd: 70, monto_usd: 25 }]);
    expect(res.valido).toBe(false);
    expect(res.restante).toBe(15);
  });

  it("es inválido si supera el saldo de una factura", () => {
    const res = validarAsignaciones(40, [{ saldo_usd: 10, monto_usd: 40 }]);
    expect(res.valido).toBe(false);
    expect(res.errores.length).toBeGreaterThan(0);
  });

  it("es inválido si hay montos negativos", () => {
    const res = validarAsignaciones(40, [{ saldo_usd: 70, monto_usd: -5 }]);
    expect(res.valido).toBe(false);
  });
});
