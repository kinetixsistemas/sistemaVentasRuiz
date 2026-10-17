import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import {
  listarSaldoPendiente,
  obtenerSaldoPendiente,
  ultimosPagos,
} from "@/features/cobranza/actions";
import { resumenCartera } from "@/features/ventas/actions";
import { numeroPagina, POR_PAGINA, rangoDeUrl } from "@/lib/pagination";

const CobranzaApp = dynamic(
  () => import("@/features/cobranza/components/cobranza-app").then((m) => m.CobranzaApp),
  { loading: () => <ListSkeleton rows={4} /> }
);

export const metadata: Metadata = {
  title: "Cobranza",
};

export default async function CobranzaPage({
  searchParams,
}: {
  searchParams: Promise<{
    pedido?: string | string[];
    pagina?: string | string[];
    desde?: string | string[];
    hasta?: string | string[];
  }>;
}) {
  const { pedido, pagina, desde, hasta } = await searchParams;
  const pedidoId = Array.isArray(pedido) ? (pedido[0] ?? "") : (pedido ?? "");
  const paginaActual = numeroPagina(pagina);
  const rango = rangoDeUrl(desde, hasta);

  const [saldosRes, pagosRes, carteraRes, pedidoRes] = await Promise.all([
    listarSaldoPendiente({
      pagina: paginaActual,
      porPagina: POR_PAGINA,
      fecha_desde: rango.desde || undefined,
      fecha_hasta: rango.hasta || undefined,
    }),
    ultimosPagos({ limite: 10 }),
    resumenCartera(),
    pedidoId ? obtenerSaldoPendiente({ factura_id: pedidoId }) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cobranza" description="Saldos pendientes y cobros registrados" icon="payments" />
      <CobranzaApp
        datos={saldosRes.ok ? saldosRes.data : { facturas: [], total: 0 }}
        paginaInicial={paginaActual}
        rangoInicial={rango}
        ultimosPagos={pagosRes.ok ? pagosRes.data : []}
        cartera={carteraRes.ok ? carteraRes.data : null}
        pedidoFactura={pedidoRes && pedidoRes.ok ? pedidoRes.data : null}
        errorMensaje={saldosRes.ok ? undefined : saldosRes.error.message}
      />
    </div>
  );
}
