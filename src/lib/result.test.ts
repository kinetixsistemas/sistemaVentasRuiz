import { describe, expect, it } from "vitest";
import {
  fieldErrorsFromZod,
  fromPostgresError,
  fromZodError,
  postgresErrorToMessage,
  esErrorDeControlNext,
} from "./result";

describe("postgresErrorToMessage", () => {
  it("mapea duplicados por restricción", () => {
    expect(
      postgresErrorToMessage({
        code: "23505",
        message: 'duplicate key value violates unique constraint "productos_codigo_key"',
      })
    ).toBe("El código ya existe");
    expect(
      postgresErrorToMessage({
        code: "23505",
        message: 'duplicate key value violates unique constraint "clientes_rif_key"',
      })
    ).toBe("El RIF ya está registrado");
    expect(
      postgresErrorToMessage({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "facturas_numero_factura_key"',
      })
    ).toBe("Ese número de factura ya existe");
  });

  it("mapea restricciones, relaciones y nulos", () => {
    expect(postgresErrorToMessage({ code: "23514", message: "x" })).toBe(
      "La operación no cumple con las reglas de validación del sistema."
    );
    expect(postgresErrorToMessage({ code: "23503", message: "x" })).toBe(
      "No se puede completar la operación porque el registro está relacionado con otros datos."
    );
    expect(postgresErrorToMessage({ code: "23502", message: "x" })).toBe(
      "Hay un campo obligatorio sin valor."
    );
  });

  it("mapea los códigos propios de las RPC", () => {
    expect(
      postgresErrorToMessage({
        code: "KX001",
        message: 'Stock insuficiente para el producto "P001"',
      })
    ).toBe('Stock insuficiente para el producto "P001"');
    expect(postgresErrorToMessage({ code: "KX001", message: "" })).toBe(
      "Stock insuficiente para facturar."
    );
    expect(
      postgresErrorToMessage({ code: "KX003", message: "" })
    ).toBe("El pago no es válido.");
  });

  it("usa un mensaje genérico para errores desconocidos", () => {
    expect(postgresErrorToMessage({ code: "99999", message: "raw db text" })).toBe(
      "No se pudo completar la operación. Vuelve a intentarlo."
    );
    expect(postgresErrorToMessage(undefined)).toBe("Ocurrió un error inesperado.");
  });
});

describe("fromPostgresError", () => {
  it("devuelve un ActionResult con código y mensaje", () => {
    const result = fromPostgresError<null>({ code: "KX001", message: "Sin stock" });
    expect(result).toEqual({
      ok: false,
      error: { code: "KX001", message: "Sin stock" },
    });
    expect(result.ok).toBe(false);
  });

  it("re-lanza los errores de control de flujo de Next", () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/login;307;",
    });
    expect(esErrorDeControlNext(redirectError)).toBe(true);
    expect(esErrorDeControlNext({ digest: "DYNAMIC_SERVER_USAGE" })).toBe(true);
    expect(esErrorDeControlNext({ code: "23505" })).toBe(false);
    expect(() => fromPostgresError<null>(redirectError)).toThrow(redirectError);
  });
});

describe("fieldErrorsFromZod", () => {
  it("extrae un mensaje por campo", () => {
    const issues = [
      { path: ["email"], message: "El correo debe tener un formato válido" },
      { path: ["password"], message: "La contraseña es obligatoria" },
    ];
    expect(fieldErrorsFromZod({ issues })).toEqual({
      email: "El correo debe tener un formato válido",
      password: "La contraseña es obligatoria",
    });
  });

  it("conserva solo el primer mensaje por campo", () => {
    const issues = [
      { path: ["telefono"], message: "Primer error" },
      { path: ["telefono"], message: "Segundo error" },
    ];
    expect(fieldErrorsFromZod({ issues })).toEqual({ telefono: "Primer error" });
  });

  it("devuelve undefined si no hay issues", () => {
    expect(fieldErrorsFromZod(undefined)).toBeUndefined();
    expect(fieldErrorsFromZod({})).toBeUndefined();
  });
});

describe("fromZodError", () => {
  it("devuelve un ActionResult de validación con fieldErrors", () => {
    const result = fromZodError<null>({
      issues: [{ path: ["codigo"], message: "El código es obligatorio" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
      expect(result.error.fieldErrors).toEqual({ codigo: "El código es obligatorio" });
    }
  });
});