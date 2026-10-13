import { describe, expect, it } from "vitest";
import { actualizarPerfilSchema, crearUsuarioSchema } from "./schemas";

describe("crearUsuarioSchema", () => {
  it("acepta un usuario válido y normaliza el correo", () => {
    const parsed = crearUsuarioSchema.parse({
      nombre: "Ana Pérez",
      correo: " ANA@Empresa.COM ",
      password: "secreto123",
      rol: "vendedor",
    });
    expect(parsed.correo).toBe("ana@empresa.com");
    expect(parsed.rol).toBe("vendedor");
  });

  it("exige una contraseña de al menos 8 caracteres", () => {
    const parsed = crearUsuarioSchema.safeParse({
      nombre: "Ana",
      correo: "ana@empresa.com",
      password: "corta",
      rol: "admin",
    });
    expect(parsed.success).toBe(false);
  });

  it("rechaza un rol inválido", () => {
    const parsed = crearUsuarioSchema.safeParse({
      nombre: "Ana",
      correo: "ana@empresa.com",
      password: "secreto123",
      rol: "jefe",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("actualizarPerfilSchema", () => {
  it("permite omitir correo y contraseña", () => {
    const parsed = actualizarPerfilSchema.parse({ nombre: "Ana" });
    expect(parsed.correo).toBeUndefined();
    expect(parsed.password).toBeUndefined();
  });

  it("valida la contraseña solo cuando se envía", () => {
    expect(
      actualizarPerfilSchema.safeParse({ nombre: "Ana", password: "12345678" }).success
    ).toBe(true);
    expect(
      actualizarPerfilSchema.safeParse({ nombre: "Ana", password: "123" }).success
    ).toBe(false);
  });
});
