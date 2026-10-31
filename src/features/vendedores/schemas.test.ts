import { describe, expect, it } from "vitest";
import {
  actualizarVendedorSchema,
  comisionPctSchema,
  crearVendedorSchema,
  historialVendedorSchema,
  pagarComisionVendedorSchema,
  resumenVendedoresSchema,
} from "./schemas";

describe("crearVendedorSchema", () => {
  it("acepta un vendedor válido y normaliza el nombre", () => {
    const parsed = crearVendedorSchema.parse({
      nombre: "  Ana María O'Brien  ",
      comision_pct: "5,5",
      activo: true,
    });

    expect(parsed.nombre).toBe("Ana María O'Brien");
    expect(parsed.comision_pct).toBe(5.5);
  });

  it("usa 0 cuando la comisión viene vacía", () => {
    const parsed = crearVendedorSchema.parse({
      nombre: "Pedro Salas",
      comision_pct: "",
    });

    expect(parsed.comision_pct).toBe(0);
    expect(parsed.activo).toBe(true);
  });

  it("rechaza nombres con números", () => {
    const parsed = crearVendedorSchema.safeParse({
      nombre: "Vendedor 1",
      comision_pct: 5,
    });

    expect(parsed.success).toBe(false);
  });
});

describe("comisionPctSchema", () => {
  it("acepta los límites 0 y 100", () => {
    expect(comisionPctSchema.parse(0)).toBe(0);
    expect(comisionPctSchema.parse(100)).toBe(100);
  });

  it("rechaza comisiones fuera de rango", () => {
    expect(comisionPctSchema.safeParse(-1).success).toBe(false);
    expect(comisionPctSchema.safeParse(100.01).success).toBe(false);
  });

  it("acepta dos decimales sin falsos negativos por punto flotante", () => {
    expect(comisionPctSchema.safeParse(5.55).success).toBe(true);
    expect(comisionPctSchema.safeParse(99.99).success).toBe(true);
  });

  it("rechaza más de dos decimales", () => {
    expect(comisionPctSchema.safeParse(5.555).success).toBe(false);
  });

  it("rechaza texto que no es un número", () => {
    expect(comisionPctSchema.safeParse("cinco").success).toBe(false);
  });
});

describe("actualizarVendedorSchema", () => {
  it("exige un identificador UUID", () => {
    const valido = actualizarVendedorSchema.safeParse({
      id: "8f4d2c1a-1111-4222-8333-123456789abc",
      nombre: "Luis Márquez",
      comision_pct: "3,25",
      activo: false,
    });
    const invalido = actualizarVendedorSchema.safeParse({
      id: "luis",
      nombre: "Luis Márquez",
      comision_pct: 3,
      activo: true,
    });

    expect(valido.success).toBe(true);
    expect(invalido.success).toBe(false);
  });
});

describe("resumenVendedoresSchema", () => {
  it("convierte fechas vacías en undefined", () => {
    const parsed = resumenVendedoresSchema.parse({ desde: "", hasta: "" });
    expect(parsed.desde).toBeUndefined();
    expect(parsed.hasta).toBeUndefined();
  });

  it("acepta un rango válido", () => {
    const parsed = resumenVendedoresSchema.safeParse({
      desde: "2026-01-01",
      hasta: "2026-01-31",
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza un rango invertido o fechas inválidas", () => {
    expect(
      resumenVendedoresSchema.safeParse({
        desde: "2026-02-01",
        hasta: "2026-01-01",
      }).success
    ).toBe(false);
    expect(
      resumenVendedoresSchema.safeParse({
        desde: "2026-13-01",
        hasta: "2026-13-31",
      }).success
    ).toBe(false);
  });
});

describe("historialVendedorSchema", () => {
  it("usa paginación por defecto", () => {
    const parsed = historialVendedorSchema.parse({
      vendedor_id: "8f4d2c1a-1111-4222-8333-123456789abc",
    });

    expect(parsed.pagina).toBe(1);
    expect(parsed.porPagina).toBe(10);
  });

  it("rechaza identificadores, páginas y tamaños inválidos", () => {
    const base = { vendedor_id: "8f4d2c1a-1111-4222-8333-123456789abc" };

    expect(historialVendedorSchema.safeParse({ ...base, vendedor_id: "luis" }).success).toBe(
      false
    );
    expect(historialVendedorSchema.safeParse({ ...base, pagina: 0 }).success).toBe(false);
    expect(historialVendedorSchema.safeParse({ ...base, porPagina: 51 }).success).toBe(false);
  });
});

describe("pagarComisionVendedorSchema", () => {
  it("acepta un pago en efectivo válido sin porcentaje manual", () => {
    const parsed = pagarComisionVendedorSchema.parse({
      factura_id: "8f4d2c1a-1111-4222-8333-123456789abc",
      metodo: "efectivo",
      monto: "5.25",
    });

    expect(parsed.metodo).toBe("efectivo");
    expect(parsed.monto).toBe(5.25);
  });

  it("exige tasa y referencia para pagos en bolívares", () => {
    const factura_id = "8f4d2c1a-1111-4222-8333-123456789abc";

    expect(
      pagarComisionVendedorSchema.safeParse({
        factura_id,
        metodo: "bs",
        monto: 100,
      }).success
    ).toBe(false);
    expect(
      pagarComisionVendedorSchema.safeParse({
        factura_id,
        metodo: "bs",
        monto: 100,
        tasa_cambio: 50,
        referencia: "REF123",
      }).success
    ).toBe(true);
  });

  it("exige correo y referencia para transferencias digitales", () => {
    const factura_id = "8f4d2c1a-1111-4222-8333-123456789abc";

    expect(
      pagarComisionVendedorSchema.safeParse({
        factura_id,
        metodo: "zelle",
        monto: 5,
      }).success
    ).toBe(false);
    expect(
      pagarComisionVendedorSchema.safeParse({
        factura_id,
        metodo: "zelle",
        monto: 5,
        correo: "test@test.com",
        referencia: "ABC123",
      }).success
    ).toBe(true);
  });

  it("rechaza facturas inválidas y montos no positivos", () => {
    const factura_id = "8f4d2c1a-1111-4222-8333-123456789abc";

    expect(
      pagarComisionVendedorSchema.safeParse({
        factura_id: "factura",
        metodo: "efectivo",
        monto: 1,
      }).success
    ).toBe(false);
    expect(
      pagarComisionVendedorSchema.safeParse({
        factura_id,
        metodo: "efectivo",
        monto: 0,
      }).success
    ).toBe(false);
  });
});
