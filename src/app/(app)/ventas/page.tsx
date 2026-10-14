import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { listarFacturas, resumenCartera, resumenVentas } from "@/features/ventas/actions";
import { listarClientes } from "@/features/clientes/actions";
import { listarProductos } from "@/features/inventario/actions";
import { VentasApp } from "@/features/ventas/components/ventas-app";
import { periodoDelMes } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Ventas",
};

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ nueva?: string | string[] }>;
}) {
  const { nueva } = await searchParams;
  const abrirNueva = (Array.isArray(nueva) ? nueva[0] : nueva) === "1";
  const periodoActual = periodoDelMes();

  const [resumenRes, resumenVentasRes, facturasRes, clientesRes, productosRes] = await Promise.all([
    resumenCartera(),
    resumenVentas(periodoActual),
    listarFacturas({ estado: "todas", limite: 50 }),
    listarClientes({ porPagina: 100 }),
    listarProductos({ porPagina: 100 }),
  ]);

  const resultados = [resumenRes, resumenVentasRes, facturasRes, clientesRes, productosRes];
  const fallo = resultados.some((r) => !r.ok);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Ventas" description="Facturas de contado y crédito" icon="receipt_long" />
      <VentasApp
        facturas={facturasRes.ok ? facturasRes.data : []}
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