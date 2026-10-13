import { describe, expect, it } from "vitest";
import { escaparFiltroPostgrest } from "./postgrest";

describe("escaparFiltroPostgrest", () => {
  it("entrecomilla valores simples", () => {
    expect(escaparFiltroPostgrest("%cemento%")).toBe('"%cemento%"');
  });

  it("protege comas y paréntesis que romperían el filtro or", () => {
    expect(escaparFiltroPostgrest("%a,b%")).toBe('"%a,b%"');
    expect(escaparFiltroPostgrest("%a(b)%")).toBe('"%a(b)%"');
  });

  it("escapa comillas dobles y barras invertidas", () => {
    expect(escaparFiltroPostgrest('a"b')).toBe('"a\\"b"');
    expect(escaparFiltroPostgrest("a\\b")).toBe('"a\\\\b"');
  });
});
