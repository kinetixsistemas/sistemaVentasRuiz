import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { listarFacturas, resumenCartera, resumenVentas } from "@/features/ventas/actions";
import { listarClientes } from "@/features/clientes/actions";
import { listarProductos } from "@/features/inventario/actions";
import { periodoDelMes } from "@/lib/dates";
import { numeroPagina, POR_PAGINA, rangoDeUrl } from "@/lib/pagination";

const VentasApp = dynamic(
  () => import("@/features/ventas/components/ventas-app").then((m) => m.VentasApp),
  { loading: () => <ListSkeleton rows={4} /> }
);

export const metadata: Metadata = {
  title: "Ventas",
};

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{
    nueva?: string | string[];
    pagina?: string | string[];
    desde?: string | string[];
    hasta?: string | string[];
  }>;
}) {
  const { nueva, pagina, desde, hasta } = await searchParams;
  const abrirNueva = (Array.isArray(nueva) ? nueva[0] : nueva) === "1";
  const paginaActual = numeroPagina(pagina);
  const rango = rangoDeUrl(desde, hasta);
  const periodoActual = periodoDelMes();

  const [resumenRes, resumenVentasRes, facturasRes, clientesRes, productosRes] = await Promise.all([
    resumenCartera(),
    resumenVentas(periodoActual),
    listarFacturas({
      estado: "todas",
      pagina: paginaActual,
      porPagina: POR_PAGINA,
      fecha_desde: rango.desde || undefined,
      fecha_hasta: rango.hasta || undefined,
    }),
    listarClientes({ porPagina: 100 }),
    listarProductos({ porPagina: 100 }),
  ]);

  const resultados = [resumenRes, resumenVentasRes, facturasRes, clientesRes, productosRes];
  const fallo = resultados.some((r) => !r.ok);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Ventas" description="Facturas de contado y crédito" icon="receipt_long" />
      <VentasApp
        facturas={facturasRes.ok ? facturasRes.data.facturas : []}
        totalFacturas={facturasRes.ok ? facturasRes.data.total : 0}
        paginaInicial={paginaActual}
        rangoInicial={rango}
        resumen={resumenRes.ok ? resumenRes.data : null}
        clientes={clientesRes.ok ? clientesRes.data.clientes : []}
        productos={productosRes.ok ? productosRes.data.productos : []}
        abrirNueva={abrirNueva}
        periodoInicial={periodoActual}
        periodoActual={periodoActual}
        resumenVentasInicial={resumenVentasRes.ok ? resumenVentasRes.data : null}
        errorMensaje={
          fallo
            ? "No se pudieron cargar todos los datos de ventas. Revisa tu conexión e inténtalo de nuevo."
            : undefined
        }
      />
    </div>
  );
}
