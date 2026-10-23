import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { listarClientes } from "@/features/clientes/actions";
import { listarVendedores } from "@/features/vendedores/actions";
import { numeroPagina, POR_PAGINA } from "@/lib/pagination";

const ClientesApp = dynamic(
  () => import("@/features/clientes/components/clientes-app").then((m) => m.ClientesApp),
  { loading: () => <ListSkeleton rows={4} /> }
);

export const metadata: Metadata = {
  title: "Clientes",
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; pagina?: string | string[] }>;
}) {
  const { q, pagina } = await searchParams;
  const busqueda = Array.isArray(q) ? (q[0] ?? "") : (q ?? "");
  const paginaActual = numeroPagina(pagina);

  const [res, vendedoresRes] = await Promise.all([
    listarClientes({
      busqueda: busqueda || undefined,
      pagina: paginaActual,
      porPagina: POR_PAGINA,
    }),
    listarVendedores(),
  ]);

  const errorMensaje =
    !res.ok || !vendedoresRes.ok
      ? "No se pudieron cargar todos los datos de clientes. Revisa tu conexión e inténtalo de nuevo."
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clientes" description="Reseñas, encargados y datos de contacto" icon="groups" />
      <ClientesApp
        datos={res.ok ? res.data : { clientes: [], total: 0 }}
        vendedores={vendedoresRes.ok ? vendedoresRes.data : []}
        busquedaInicial={busqueda}
        paginaInicial={paginaActual}
        errorMensaje={errorMensaje}
      />
    </div>
  );
}