import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { listarSaldoPendiente, ultimosPagos } from "@/features/cobranza/actions";
import { CobranzaApp } from "@/features/cobranza/components/cobranza-app";

export const metadata: Metadata = {
  title: "Cobranza",
};

export default async function CobranzaPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string | string[] }>;
}) {
  const { pedido } = await searchParams;
  const pedidoId = Array.isArray(pedido) ? (pedido[0] ?? "") : (pedido ?? "");

  const [saldosRes, pagosRes] = await Promise.all([
    listarSaldoPendiente({ porPagina: 100 }),
    ultimosPagos({ limite: 10 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cobranza" description="Saldos pendientes y cobros registrados" icon="payments" />
      <CobranzaApp
        datos={saldosRes.ok ? saldosRes.data : { facturas: [], total: 0 }}
        ultimosPagos={pagosRes.ok ? pagosRes.data : []}
        pedidoFacturaId={pedidoId || null}
        errorMensaje={saldosRes.ok ? undefined : saldosRes.error.message}
      />
    </div>
  );
}