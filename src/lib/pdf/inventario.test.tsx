import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { InventarioPDF } from "./inventario";

describe("InventarioPDF", () => {
  it("renderiza un PDF con productos y resumen", async () => {
    const buffer = await renderToBuffer(
      <InventarioPDF
        productos={[
          {
            id: "p1",
            codigo: "TR-001",
            nombre: "Tripa delantera",
            cantidad: 3,
            precio_usd: 12.5,
            foto_url: null,
            categoria_id: "c1",
          },
        ]}
        categorias={[{ id: "c1", nombre: "Tripas" }]}
        empresa={null}
        existencia="todo"
        generadoEl="22 de octubre de 2026"
      />
    );

    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
