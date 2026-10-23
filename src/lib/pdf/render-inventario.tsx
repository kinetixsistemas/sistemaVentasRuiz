import { renderToBuffer } from "@react-pdf/renderer";
import { obtenerEmpresaService } from "@/features/empresa/service";
import {
  listarCategoriasService,
  listarProductosParaPdfService,
} from "@/features/inventario/service";
import type { CategoriaFiltro, ExistenciaFiltro } from "@/features/inventario/schemas";
import { InventarioPDF } from "./inventario";

/** Renderiza el PDF completo del inventario (entorno Node). */
export async function renderInventarioPdf(opciones: {
  busqueda?: string;
  existencia: ExistenciaFiltro;
  categoria?: CategoriaFiltro;
}): Promise<Buffer> {
  const [productosRes, categoriasRes, empresaRes] = await Promise.all([
    listarProductosParaPdfService(opciones.busqueda, opciones.existencia, opciones.categoria ?? null),
    listarCategoriasService(),
    obtenerEmpresaService(),
  ]);

  if (!productosRes.ok) throw new Error(productosRes.error.message);
  if (!categoriasRes.ok) throw new Error(categoriasRes.error.message);

  const generadoEl = new Intl.DateTimeFormat("es-VE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  const categoriaNombre =
    opciones.categoria === "sin"
      ? "Sin categoría"
      : opciones.categoria
        ? (categoriasRes.data.find((c) => c.id === opciones.categoria)?.nombre ?? "Categoría")
        : undefined;

  return renderToBuffer(
    <InventarioPDF
      productos={productosRes.data}
      categorias={categoriasRes.data}
      empresa={empresaRes.ok ? empresaRes.data : null}
      existencia={opciones.existencia}
      categoria={categoriaNombre}
      busqueda={opciones.busqueda}
      generadoEl={generadoEl}
    />
  );
}
