import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/ui/page-header";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { listarCategorias, listarProductos } from "@/features/inventario/actions";
import {
  categoriaFiltroSchema,
  existenciaFiltroSchema,
  type CategoriaFiltro,
  type ExistenciaFiltro,
} from "@/features/inventario/schemas";
import { obtenerEmpresaService } from "@/features/empresa/service";
import { numeroPagina, POR_PAGINA } from "@/lib/pagination";

const InventarioApp = dynamic(
  () => import("@/features/inventario/components/inventario-app").then((m) => m.InventarioApp),
  { loading: () => <CardGridSkeleton /> }
);

export const metadata: Metadata = {
  title: "Inventario",
};

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    existencia?: string | string[];
    categoria?: string | string[];
    pagina?: string | string[];
  }>;
}) {
  const { q, existencia, categoria, pagina } = await searchParams;
  const busqueda = Array.isArray(q) ? (q[0] ?? "") : (q ?? "");
  const existenciaRaw = Array.isArray(existencia) ? (existencia[0] ?? "todo") : (existencia ?? "todo");
  const filtroParseado = existenciaFiltroSchema.safeParse(existenciaRaw);
  const filtro: ExistenciaFiltro = filtroParseado.success ? filtroParseado.data : "todo";
  const categoriaRaw = Array.isArray(categoria) ? (categoria[0] ?? null) : (categoria ?? null);
  const categoriaFiltro: CategoriaFiltro = categoriaFiltroSchema.parse(categoriaRaw);
  const paginaActual = numeroPagina(pagina);

  const [prodRes, catRes, empRes] = await Promise.all([
    listarProductos({
      busqueda: busqueda || undefined,
      existencia: filtro,
      categoria: categoriaFiltro,
      pagina: paginaActual,
      porPagina: POR_PAGINA,
    }),
    listarCategorias(),
    obtenerEmpresaService(),
  ]);

  return (
    <div
      className="relative left-1/2 flex w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-6 lg:w-[calc(100vw-17rem-3rem)]"
    >
      <PageHeader
        title="Inventario"
        description="Productos y existencias de tu negocio"
        icon="inventory_2"
      />

      <InventarioApp
        datos={prodRes.ok ? prodRes.data : { productos: [], total: 0 }}
        categorias={catRes.ok ? catRes.data : []}
        busquedaInicial={busqueda}
        existenciaInicial={filtro}
        categoriaInicial={categoriaFiltro}
        paginaInicial={paginaActual}
        errorMensaje={prodRes.ok ? undefined : prodRes.error.message}
        umbralStock={empRes.ok ? empRes.data.stock_bajo_umbral : 5}
      />
    </div>
  );
}