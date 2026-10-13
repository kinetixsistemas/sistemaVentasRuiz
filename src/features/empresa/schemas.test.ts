import { describe, expect, it } from "vitest";
import { actualizarEmpresaSchema } from "./schemas";

describe("actualizarEmpresaSchema", () => {
  it("normaliza el RIF al formato canónico", () => {
    const parsed = actualizarEmpresaSchema.parse({
      nombre_comercial: "  Mi Empresa  ",
      rif: "j12345678-9",
    });
    expect(parsed.nombre_comercial).toBe("Mi Empresa");
    expect(parsed.rif).toBe("J-12345678-9");
  });

  it("rechaza un RIF inválido", () => {
    const parsed = actualizarEmpresaSchema.safeParse({
      nombre_comercial: "Mi Empresa",
      rif: "X-12345678-9",
    });
    expect(parsed.success).toBe(false);
  });

  it("convierte campos opcionales vacíos en undefined y normaliza el correo", () => {
    const parsed = actualizarEmpresaSchema.parse({
      nombre_comercial: "Mi Empresa",
      razon_social: "",
      telefono: "   ",
      correo: " VENTAS@Empresa.COM ",
      direccion: "",
    });
    expect(parsed.razon_social).toBeUndefined();
    expect(parsed.telefono).toBeUndefined();
    expect(parsed.direccion).toBeUndefined();
    expect(parsed.correo).toBe("ventas@empresa.com");
  });

  it("normaliza el teléfono a solo dígitos", () => {
    const parsed = actualizarEmpresaSchema.parse({
      nombre_comercial: "Mi Empresa",
      telefono: "+58 412-123-4567",
    });
    expect(parsed.telefono).toBe("584121234567");
  });

  it("usa 5 como umbral por defecto y rechaza negativos", () => {
    expect(
      actualizarEmpresaSchema.parse({ nombre_comercial: "Mi Empresa" }).stock_bajo_umbral
    ).toBe(5);
    expect(
      actualizarEmpresaSchema.safeParse({ nombre_comercial: "Mi Empresa", stock_bajo_umbral: -1 })
        .success
    ).toBe(false);
  });

  it("exige el nombre comercial", () => {
    expect(actualizarEmpresaSchema.safeParse({ nombre_comercial: "  " }).success).toBe(false);
  });
});
