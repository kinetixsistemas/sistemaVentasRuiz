import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { listarClientes } from "@/features/clientes/actions";
import { ClientesApp } from "@/features/clientes/components/clientes-app";

export const metadata: Metadata = {
  title: "Clientes",
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const busqueda = Array.isArray(q) ? (q[0] ?? "") : (q ?? "");

  const res = await listarClientes({ busqueda: busqueda || undefined, porPagina: 100 });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clientes" description="Reseñas, encargados y datos de contacto" icon="groups" />
      <ClientesApp
        datos={res.ok ? res.data : { clientes: [], total: 0 }}
        busquedaInicial={busqueda}
        errorMensaje={res.ok ? undefined : res.error.message}
      />
    </div>
  );
}