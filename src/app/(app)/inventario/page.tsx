import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { listarProductos } from "@/features/inventario/actions";
import { obtenerEmpresaService } from "@/features/empresa/service";

const InventarioApp = dynamic(
  () => import("@/features/inventario/components/inventario-app").then((m) => m.InventarioApp),
  { loading: () => <ListSkeleton rows={4} /> }
);

export const metadata: Metadata = {
  title: "Inventario",
};

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const busqueda = Array.isArray(q) ? (q[0] ?? "") : (q ?? "");

  const [prodRes, empRes] = await Promise.all([
    listarProductos({ busqueda: busqueda || undefined, porPagina: 100 }),
    obtenerEmpresaService(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventario"
        description="Productos y existencias de tu negocio"
        icon="inventory_2"
      />
      <InventarioApp
        datos={prodRes.ok ? prodRes.data : { productos: [], total: 0 }}
        busquedaInicial={busqueda}
        errorMensaje={prodRes.ok ? undefined : prodRes.error.message}
        umbralStock={empRes.ok ? empRes.data.stock_bajo_umbral : 5}
      />
    </div>
  );
}