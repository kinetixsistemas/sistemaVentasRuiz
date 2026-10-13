"use client";

import { useState, useTransition } from "react";
import { procesarPago } from "@/features/cobranza/actions";
import type { ListarSaldoPendienteResult, SaldoPendiente, UltimoCobro } from "@/features/cobranza/schemas";
import type { MetodoPago } from "@/types/database";
import { round2 } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { EstadoChip } from "@/components/ui/estado-chip";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";
import { formatFecha, formatUsd, labelMetodoPago } from "@/components/ui/format";

const METODO_ICONO: Record<MetodoPago, string> = {
  bs: "metodo_bs",
  efectivo: "metodo_efectivo",
  zelle: "metodo_zelle",
  binance: "metodo_binance",
};

export function CobranzaApp({
  datos,
  ultimosPagos: pagosIniciales,
  pedidoFacturaId,
  errorMensaje,
}: {
  datos: ListarSaldoPendienteResult;
  ultimosPagos: UltimoCobro[];
  pedidoFacturaId: string | null;
  errorMensaje?: string;
}) {
  const toast = useToast();

  const [facturas, setFacturas] = useState<SaldoPendiente[]>(datos.facturas);
  const [pagos, setPagos] = useState<UltimoCobro[]>(pagosIniciales);
  const [totalSaldo, setTotalSaldo] = useState(datos.total);

  const [pago, setPago] = useState<SaldoPendiente | null>(() => {
    if (!pedidoFacturaId) return null;
    return datos.facturas.find((f) => f.factura_id === pedidoFacturaId) ?? null;
  });

  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [monto, setMonto] = useState("");
  const [tasa, setTasa] = useState("");
  const [referencia, setReferencia] = useState("");
  const [correo, setCorreo] = useState("");
  const [fecha, setFecha] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, startGuardar] = useTransition();

  const esBs = metodo === "bs";
  const esDigital = metodo === "zelle" || metodo === "binance";
  const montoNum = Number(monto) || 0;
  const usdEstimado = esBs && Number(tasa) > 0 ? round2(montoNum / Number(tasa)) : montoNum;

  const totalPendiente = facturas.reduce((acc, f) => acc + f.saldo_usd, 0);
  const abiertas = facturas.length;
  const vencidaMonto = facturas
    .filter((f) => f.estado === "vencida")
    .reduce((acc, f) => acc + f.saldo_usd, 0);
  const vencidaCantidad = facturas.filter((f) => f.estado === "vencida").length;
  const porVencerMonto = facturas
    .filter((f) => f.estado === "por_vencer")
    .reduce((acc, f) => acc + f.saldo_usd, 0);
  const porVencerCantidad = facturas.filter((f) => f.estado === "por_vencer").length;

  function abrirCobro(factura: SaldoPendiente) {
    setPago(factura);
    setMetodo("efectivo");
    setMonto(String(factura.saldo_usd));
    setTasa("");
    setReferencia("");
    setCorreo("");
    setFecha("");
    setErrores({});
  }

  function guardarPago(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!pago) return;
    setErrores({});
    startGuardar(async () => {
      const res = await procesarPago({
        factura_id: pago.factura_id,
        metodo,
        monto: montoNum,
        tasa_cambio: esBs && tasa !== "" ? Number(tasa) : undefined,
        referencia: referencia.trim() === "" ? undefined : referencia.trim(),
        correo: correo.trim() === "" ? undefined : correo.trim(),
        fecha: fecha === "" ? undefined : fecha,
      });

      if (!res.ok) {
        setErrores(res.error.fieldErrors ?? {});
        toast.error(res.error.message);
        return;
      }
      setPago(null);
      toast.success("Pago registrado y saldo actualizado");

      // Se actualiza la pantalla con la respuesta de la mutación, sin recargar
      // la lista completa ni los últimos cobros desde la base de datos.
      const { pago: cobro, factura_id, monto_usd, saldo_usd } = res.data;
      const saldada = saldo_usd <= 0.005;
      setFacturas((prev) =>
        prev.flatMap((f) => {
          if (f.factura_id !== factura_id) return [f];
          if (saldada) return [];
          return [
            {
              ...f,
              saldo_usd,
              total_pagado_usd: round2(f.total_pagado_usd + monto_usd),
            },
          ];
        })
      );
      if (saldada) setTotalSaldo((t) => Math.max(0, t - 1));
      setPagos((prev) => [cobro, ...prev].slice(0, 10));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {errorMensaje && <Alert tone="error">{errorMensaje}</Alert>}

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          compact
          label="Por cobrar"
          value={formatUsd(totalPendiente)}
          sub={`${abiertas} facturas`}
          icon="account_balance_wallet"
          tone="bg-primary/10 text-primary"
        />
        <StatCard
          compact
          label="Vencidas"
          value={formatUsd(vencidaMonto)}
          sub={`${vencidaCantidad} facturas`}
          icon="error"
          tone="bg-status-vencida-bg text-status-vencida-text"
        />
        <StatCard
          compact
          label="Por vencer"
          value={formatUsd(porVencerMonto)}
          sub={`${porVencerCantidad} facturas`}
          icon="schedule"
          tone="bg-status-por-vencer-bg text-status-por-vencer-text"
        />
      </div>

      <section aria-label="Saldos pendientes">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-label-lg text-on-surface-variant">Pendientes</h2>
          <span className="text-body-sm tabular-nums text-on-surface-variant">{totalSaldo}</span>
        </div>
        {facturas.length === 0 ? (
          <EmptyState
            icon="check_circle"
            title="Sin saldos pendientes"
            description="Todas las facturas están al día. En esta sección verás cuentas por cobrar."
          />
        ) : (
          <Card contentClassName="p-0">
            <ul className="divide-y divide-outline-variant">
              {facturas.map((factura) => (
                <li key={factura.factura_id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-label-lg tabular-nums text-on-surface">{factura.numero_factura}</p>
                      <EstadoChip estado={factura.estado} className="hidden sm:inline-flex" />
                    </div>
                    <p className="mt-0.5 text-body-sm text-on-surface-variant">
                      {factura.condicion === "credito" ? (
                        factura.dias_mora > 0 ? (
                          <span className="text-status-vencida-text tabular-nums">Vencida hace {factura.dias_mora} día{factura.dias_mora === 1 ? "" : "s"}</span>
                        ) : (
                          <span className="tabular-nums">Vence {formatFecha(factura.fecha_vencimiento)}</span>
                        )
                      ) : (
                        "De contado"
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-label-lg tabular-nums text-on-surface">{formatUsd(factura.saldo_usd)}</p>
                    <p className="text-body-sm text-on-surface-variant">
                      de <span className="tabular-nums">{formatUsd(factura.total_usd)}</span>
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" icon="payments" onClick={() => abrirCobro(factura)}>
                    <span className="hidden sm:inline">Cobrar</span>
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section aria-label="Últimos cobros">
        <h2 className="mb-2 text-label-lg text-on-surface-variant">Últimos cobros</h2>
        {pagos.length === 0 ? (
          <p className="py-6 text-center text-body-sm text-on-surface-variant">Aún no hay cobros registrados.</p>
        ) : (
          <Card contentClassName="p-0">
            <ul className="divide-y divide-outline-variant">
              {pagos.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
                    <Icon name={METODO_ICONO[p.metodo]} size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-md text-on-surface">
                      {p.cliente_nombre} · <span className="tabular-nums">{p.numero_factura}</span>
                    </p>
                    <p className="text-body-sm text-on-surface-variant">
                      {labelMetodoPago(p.metodo)} · {formatFecha(p.fecha)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-label-lg tabular-nums text-on-surface">{formatUsd(p.monto_usd)}</p>
                    {p.moneda === "VES" && (
                      <p className="text-body-sm text-on-surface-variant tabular-nums">
                        Bs {p.monto_original.toLocaleString("es-VE", { maximumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <Modal
        open={pago !== null}
        onClose={() => setPago(null)}
        title={pago ? `Cobrar factura ${pago.numero_factura}` : ""}
        size="sm"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" className="w-full sm:flex-1" disabled={guardando} onClick={() => setPago(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-pago" icon="payments" loading={guardando} className="w-full sm:flex-1">
              Registrar pago
            </Button>
          </div>
        }
      >
        {pago && (
          <form id="form-pago" onSubmit={guardarPago} className="flex flex-col gap-4" noValidate>
            <div className="flex items-center justify-between rounded-xl bg-surface-container px-4 py-3">
              <span className="text-label-md text-on-surface-variant">Saldo pendiente</span>
              <span className="text-label-lg tabular-nums text-on-surface">{formatUsd(pago.saldo_usd)}</span>
            </div>

            <Select
              label="Método de pago"
              name="metodo"
              value={metodo}
              onChange={(e) => setMetodo(e.target.value as MetodoPago)}
              options={[
                { value: "efectivo", label: "Efectivo (USD)" },
                { value: "bs", label: "Bolívares" },
                { value: "zelle", label: "Zelle" },
                { value: "binance", label: "Binance" },
              ]}
              error={errores.metodo}
            />

            <Input
              label="Monto"
              name="monto"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              error={errores.monto}
              hint={esBs ? "Monto en bolívares. Se convierte con la tasa que indiques." : "Monto en dólares estadounidenses (USD)."}
              required
            />

            {esBs && (
              <Input
                label="Tasa de cambio (Bs por USD)"
                name="tasa_cambio"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="Ej. 36,50"
                value={tasa}
                onChange={(e) => setTasa(e.target.value)}
                error={errores.tasa_cambio}
                hint={Number(tasa) > 0 && montoNum > 0 ? `Equivale a ${formatUsd(usdEstimado)}` : "La tasa se registra manualmente, sin BCV."}
              />
            )}

            {esDigital && (
              <Input
                label="Correo asociado"
                name="correo"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                error={errores.correo}
                required
              />
            )}

            <Input
              label="Referencia"
              name="referencia"
              placeholder="Nº de referencia del pago"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              error={errores.referencia}
              hint={esBs || esDigital ? "Obligatoria para este método." : undefined}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Fecha"
                name="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                error={errores.fecha}
                hint="Hoy por defecto"
              />
              <div className={cn("flex items-end pb-1", !esBs && "hidden")}>
                <p className="w-full rounded-lg bg-surface-container px-3.5 py-2 text-body-md tabular-nums text-on-surface-variant">
                  {Number(tasa) > 0 ? `${formatUsd(usdEstimado)} USA` : "—"}
                </p>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}