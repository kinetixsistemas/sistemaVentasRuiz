import type { Metadata } from "next";
import Link from "next/link";
import { listarFacturas, resumenCartera } from "@/features/ventas/actions";
import { ultimosPagos } from "@/features/cobranza/actions";
import { listarStockBajo } from "@/features/inventario/actions";
import { obtenerEmpresaService } from "@/features/empresa/service";
import type { FacturaConSaldo } from "@/features/ventas/schemas";
import type { UltimoCobro } from "@/features/cobranza/schemas";
import type { Producto } from "@/features/inventario/schemas";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EstadoChip } from "@/components/ui/estado-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/components/ui/cn";
import { formatUsd, formatFecha, labelMetodoPago } from "@/components/ui/format";

export const metadata: Metadata = {
  title: "Resumen",
};

type AccionRapida = { href: string; label: string; icon: string };

const ACCIONES_RAPIDAS: AccionRapida[] = [
  { href: "/ventas?nueva=1", label: "Nueva venta", icon: "point_of_sale" },
  { href: "/clientes", label: "Nuevo cliente", icon: "person_add" },
  { href: "/inventario", label: "Nuevo producto", icon: "add_box" },
  { href: "/cobranza", label: "Registrar pago", icon: "payments" },
];

function ListaCobros({ cobros }: { cobros: UltimoCobro[] }) {
  if (cobros.length === 0) {
    return (
      <EmptyState
        icon="payments"
        title="Aún no hay cobros"
        description="Cuando registres un pago aparecerá aquí."
      />
    );
  }
  return (
    <ul className="divide-y divide-outline-variant">
      {cobros.map((cobro) => (
        <li key={cobro.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-label-lg text-on-surface">{cobro.cliente_nombre}</p>
            <p className="text-body-sm text-on-surface-variant">
              Factura {cobro.numero_factura} · {formatFecha(cobro.fecha)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-label-lg tabular-nums text-on-surface">{formatUsd(cobro.monto_usd)}</p>
            <p className="text-body-sm text-on-surface-variant">{labelMetodoPago(cobro.metodo)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ListaFacturas({ facturas }: { facturas: FacturaConSaldo[] }) {
  const recientes = [...facturas]
    .sort((a, b) => b.fecha_emision.localeCompare(a.fecha_emision))
    .slice(0, 5);

  if (recientes.length === 0) {
    return (
      <EmptyState
        icon="receipt_long"
        title="Sin facturas"
        description="Registra tu primera venta para verla aquí."
        action={<Button href="/ventas" icon="add" size="sm">Nueva venta</Button>}
      />
    );
  }

  return (
    <ul className="divide-y divide-outline-variant">
      {recientes.map((factura) => (
        <li key={factura.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-label-lg text-on-surface">{factura.nombre_juridico}</p>
            <p className="text-body-sm text-on-surface-variant">
              {factura.numero_factura} · {formatFecha(factura.fecha_emision)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <EstadoChip estado={factura.estado} />
            <p className="w-20 text-right text-label-lg tabular-nums text-on-surface">
              {formatUsd(factura.saldo_usd)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ListaStockBajo({ productos }: { productos: Producto[] }) {
  if (productos.length === 0) {
    return (
      <EmptyState
        icon="check_circle"
        title="Stock en orden"
        description="Ningún producto tiene existencias bajas."
      />
    );
  }

  return (
    <ul className="divide-y divide-outline-variant">
      {productos.map((producto) => (
        <li key={producto.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-label-lg text-on-surface">{producto.nombre}</p>
            <p className="text-body-sm text-on-surface-variant">{producto.codigo}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-label-md",
              producto.cantidad === 0
                ? "bg-status-vencida-bg text-status-vencida-text"
                : "bg-status-por-vencer-bg text-status-por-vencer-text"
            )}
          >
            {producto.cantidad} u.
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function HomePage() {
  // Los KPIs y el stock bajo se calculan en la BD; solo se traen 5 facturas
  // recientes y 10 cobros. Antes se descargaba todo el histórico y 100 productos.
  const [resumenRes, facturasRes, pagosRes, empresaRes] = await Promise.all([
    resumenCartera(),
    listarFacturas({ estado: "todas", porPagina: 5, orden: "reciente" }),
    ultimosPagos(),
    obtenerEmpresaService(),
  ]);

  const umbralStock = empresaRes.ok ? empresaRes.data.stock_bajo_umbral : 5;
  const stockRes = await listarStockBajo({ umbral: umbralStock, limite: 6 });

  const resumen = resumenRes.ok ? resumenRes.data : null;
  const facturas = facturasRes.ok ? facturasRes.data.facturas : [];
  const cobros = pagosRes.ok ? pagosRes.data : [];
  const productos = stockRes.ok ? stockRes.data : [];

  const porCobrar = resumen?.por_cobrar_usd ?? 0;
  const vencidas = resumen?.vencidas_usd ?? 0;
  const porVencer = resumen?.por_vencer_usd ?? 0;

  const errores = [
    resumenRes.ok ? null : resumenRes.error,
    facturasRes.ok ? null : facturasRes.error,
    pagosRes.ok ? null : pagosRes.error,
    stockRes.ok ? null : stockRes.error,
  ].filter(Boolean);

  if (errores.length > 0) {
    console.error("Panel: no se pudieron cargar todos los datos", errores);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Resumen"
        description="Estado de tu cartera por cobrar hoy"
        icon="dashboard"
      />

      {errores.length > 0 && (
        <Alert tone="error" title="No se pudieron cargar todos los datos">
          Revisa tu conexión e inténtalo de nuevo.
        </Alert>
      )}

      {/* Indicadores */}
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Indicadores">
        <StatCard
          label="Por cobrar"
          value={formatUsd(porCobrar)}
          icon="account_balance_wallet"
          tone="bg-primary/10 text-primary"
          sub={`${resumen?.facturas_abiertas ?? 0} facturas abiertas`}
        />
        <StatCard
          label="Vencidas"
          value={formatUsd(vencidas)}
          icon="error"
          tone="bg-status-vencida-bg text-status-vencida-text"
          sub={`${resumen?.facturas_vencidas ?? 0} facturas en mora`}
        />
        <StatCard
          label="Por vencer"
          value={formatUsd(porVencer)}
          icon="schedule"
          tone="bg-status-por-vencer-bg text-status-por-vencer-text"
          sub={`${resumen?.facturas_por_vencer ?? 0} facturas próximas`}
        />
      </section>

      {/* Acciones rápidas */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Acciones rápidas">
        {ACCIONES_RAPIDAS.map((accion) => (
          <Link
            key={accion.href}
            href={accion.href}
            className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl bg-surface-container-lowest shadow-card transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon name={accion.icon} size={22} />
            </span>
            <span className="text-label-lg text-on-surface">{accion.label}</span>
          </Link>
        ))}
      </section>

      {/* Listados recientes */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card
          title="Últimos cobros"
          subtitle="Pagos registrados recientemente"
          className="lg:col-span-1"
        >
          {pagosRes.ok ? <ListaCobros cobros={cobros} /> : <MensajeError />}
        </Card>
        <Card
          title="Facturas recientes"
          subtitle="Últimas facturas con su saldo"
          className="lg:col-span-1"
        >
          {facturasRes.ok ? <ListaFacturas facturas={facturas} /> : <MensajeError />}
        </Card>
        <Card
          title="Stock bajo"
          subtitle={`Productos con ${umbralStock} o menos unidades`}
          className="lg:col-span-1"
        >
          {stockRes.ok ? (
            <ListaStockBajo productos={productos} />
          ) : (
            <MensajeError />
          )}
        </Card>
      </section>
    </div>
  );
}

function MensajeError() {
  return (
    <Alert tone="error" className="py-4">
      No se pudieron cargar estos datos.
    </Alert>
  );
}
