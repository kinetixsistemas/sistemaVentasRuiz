import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { resumenVendedores } from "@/features/vendedores/actions";
import { periodoDelMes } from "@/lib/dates";
import { rangoDeUrl } from "@/lib/pagination";

const VendedoresApp = dynamic(
  () => import("@/features/vendedores/components/vendedores-app").then((m) => m.VendedoresApp),
  { loading: () => <ListSkeleton rows={4} /> }
);

export const metadata: Metadata = {
  title: "Vendedores",
};

export default async function VendedoresPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string | string[];
    hasta?: string | string[];
  }>;
}) {
  const { desde, hasta } = await searchParams;
  const tieneFiltroUrl = desde !== undefined || hasta !== undefined;
  const rango = tieneFiltroUrl ? rangoDeUrl(desde, hasta) : periodoDelMes();
  const res = await resumenVendedores(rango);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vendedores"
        description="Comisiones y actividad por vendedor"
        icon="person"
      />
      <VendedoresApp
        datosIniciales={res.ok ? res.data : []}
        rangoInicial={rango}
        errorMensaje={
          res.ok
            ? undefined
            : "No se pudo cargar el resumen de vendedores. Revisa tu conexión e inténtalo de nuevo."
        }
      />
    </div>
  );
}
