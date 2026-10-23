import { describe, expect, it } from "vitest";
import type { SugerenciaProducto } from "./schemas";

/**
 * Réplica local del comparador de relevancia de `listarSugerenciasRepo`.
 * Mantener sincronizado con la implementación del repositorio.
 */
function ordenarPorRelevancia(lista: SugerenciaProducto[], busqueda: string): SugerenciaProducto[] {
  const normalizado = busqueda.toLowerCase();
  return [...lista].sort((a, b) => {
    const prioridad = (p: SugerenciaProducto) =>
      p.codigo.toLowerCase().startsWith(normalizado) ||
      p.nombre.toLowerCase().startsWith(normalizado)
        ? 0
        : 1;
    return prioridad(a) - prioridad(b);
  });
}

describe("sugerencias de inventario", () => {
  it("prioriza las coincidencias por prefijo sobre las parciales", () => {
    const base: SugerenciaProducto[] = [
      { id: "1", codigo: "X-TRIPA", nombre: "Kit de tripa", cantidad: 1 },
      { id: "2", codigo: "TR-100", nombre: "Tripa reforzada", cantidad: 5 },
    ];

    const ordenado = ordenarPorRelevancia(base, "tri");
    expect(ordenado[0]?.nombre).toBe("Tripa reforzada");
  });

  it("deja las coincidencias no-prefijo al final", () => {
    const base: SugerenciaProducto[] = [
      { id: "1", codigo: "AB-1", nombre: "Repuesto de bujía", cantidad: 2 },
      { id: "2", codigo: "BU-9", nombre: "Bujía premium", cantidad: 3 },
    ];

    const ordenado = ordenarPorRelevancia(base, "buj");
    expect(ordenado[0]?.codigo).toBe("BU-9");
  });
});
