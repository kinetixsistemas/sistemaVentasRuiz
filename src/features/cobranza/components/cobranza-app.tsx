"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listarSaldoPendiente,
  procesarPago,
  procesarPagoAsignado,
  ultimosPagos,
} from "@/features/cobranza/actions";
import { resumenCartera } from "@/features/ventas/actions";
import type {
  ListarSaldoPendienteResult,
  SaldoPendiente,
  UltimoCobro,
} from "@/features/cobranza/schemas";
import type { ResumenCartera } from "@/features/ventas/schemas";
import {
  calcularExcedente,
  deudaTotalCliente,
  facturasDelCliente,
  TOLERANCIA_USD,
  validarAsignaciones,
} from "@/features/cobranza/asignacion";
import { FacturaDetalleModal } from "@/features/ventas/components/factura-detalle-modal";
import { FilaFactura } from "@/features/ventas/components/factura-fila";
import type { MetodoPago } from "@/types/database";
import { round2 } from "@/lib/currency";
import { fechaHoyISO } from "@/lib/dates";
import { POR_PAGINA } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { FiltroFechas } from "@/components/ui/filtro-fechas";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
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
  paginaInicial,
  rangoInicial,
  ultimosPagos: pagosIniciales,
  cartera: carteraInicial,
  pedidoFactura,
  errorMensaje,
}: {
  datos: ListarSaldoPendienteResult;
  paginaInicial: number;
  rangoInicial: { desde: string; hasta: string };
  ultimosPagos: UltimoCobro[];
  cartera: ResumenCartera | null;
  /** Factura abierta desde `/cobranza?pedido=<facturaId>`. */
  pedidoFactura: SaldoPendiente | null;
  errorMensaje?: string;
}) {
  const toast = useToast();

  const [facturas, setFacturas] = useState<SaldoPendiente[]>(datos.facturas);
  const [totalPendientes, setTotalPendientes] = useState(datos.total);
  const [pagina, setPagina] = useState(paginaInicial);
  const [fechaDesde, setFechaDesde] = useState(rangoInicial.desde);
  const [fechaHasta, setFechaHasta] = useState(rangoInicial.hasta);
  const [pagos, setPagos] = useState<UltimoCobro[]>(pagosIniciales);
  const [cartera, setCartera] = useState<ResumenCartera | null>(carteraInicial);
  const [recargando, startRecargar] = useTransition();

  const [pago, setPago] = useState<SaldoPendiente | null>(pedidoFactura);
  const [facturasCliente, setFacturasCliente] = useState<SaldoPendiente[]>(() =>
    pedidoFactura ? facturasDelCliente(datos.facturas, pedidoFactura.cliente_id) : []
  );
  const [detalle, setDetalle] = useState<SaldoPendiente | null>(null);

  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [monto, setMonto] = useState("");
  const [tasa, setTasa] = useState("");
  const [referencia, setReferencia] = useState("");
  const [correo, setCorreo] = useState("");
  const [fecha, setFecha] = useState(() => fechaHoyISO());
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, startGuardar] = useTransition();

  const esBs = metodo === "bs";
  const esEfectivo = metodo === "efectivo";
  const esDigital = metodo === "zelle" || metodo === "binance";
  const montoNum = Number(monto) || 0;
  const usdEstimado = esBs && Number(tasa) > 0 ? round2(montoNum / Number(tasa)) : montoNum;

  // Deuda total del cliente y excedente a repartir cuando el monto supera el
  // saldo de la factura elegida. Todo en USD (moneda base). Se usan TODAS las
  // facturas abiertas del cliente (cargadas aparte de la página visible).
  const facturasClienteTodas = pago
    ? facturasDelCliente(facturasCliente, pago.cliente_id)
    : [];
  const deudaCliente = pago ? deudaTotalCliente(facturasCliente, pago.cliente_id) : 0;
  const otrasFacturas = pago
    ? facturasClienteTodas.filter((f) => f.factura_id !== pago.factura_id)
    : [];
  const excedente = pago ? calcularExcedente(usdEstimado, pago.saldo_usd) : 0;
  const requiereAsignacion = excedente > TOLERANCIA_USD;
  const validacionAsignacion = validarAsignaciones(
    excedente,
    otrasFacturas.map((f) => ({
      saldo_usd: f.saldo_usd,
      monto_usd: Number(asignaciones[f.factura_id]) || 0,
    }))
  );

  // KPIs de toda la cartera (RPC en BD); si aún no cargan, se aproximan con la página.
  const totalPendiente = cartera?.por_cobrar_usd ?? facturas.reduce((acc, f) => acc + f.saldo_usd, 0);
  const abiertas = cartera?.facturas_abiertas ?? facturas.length;
  const vencidaMonto = cartera?.vencidas_usd ?? facturas.filter((f) => f.estado === "vencida").reduce((acc, f) => acc + f.saldo_usd, 0);
  const vencidaCantidad = cartera?.facturas_vencidas ?? facturas.filter((f) => f.estado === "vencida").length;
  const porVencerMonto = cartera?.por_vencer_usd ?? facturas.filter((f) => f.estado === "por_vencer").reduce((acc, f) => acc + f.saldo_usd, 0);
  const porVencerCantidad = cartera?.facturas_por_vencer ?? facturas.filter((f) => f.estado === "por_vencer").length;

  const filtrando = fechaDesde !== "" || fechaHasta !== "";

  /** Refleja página y rango en la URL para conservarlos al recargar. */
  function sincronizarUrl(paginaNueva: number, desde: string, hasta: string) {
    const params = new URLSearchParams();
    if (paginaNueva > 1) params.set("pagina", String(paginaNueva));
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    const query = params.toString();
    window.history.replaceState(null, "", `/cobranza${query ? `?${query}` : ""}`);
  }

  function consultar(
    paginaNueva: number,
    desde: string,
    hasta: string
  ) {
    startRecargar(async () => {
      const res = await listarSaldoPendiente({
        pagina: paginaNueva,
        porPagina: POR_PAGINA,
        fecha_desde: desde || undefined,
        fecha_hasta: hasta || undefined,
      });
      if (res.ok) {
        setFacturas(res.data.facturas);
        setTotalPendientes(res.data.total);
        setPagina(paginaNueva);
        sincronizarUrl(paginaNueva, desde, hasta);
      } else {
        toast.error(res.error.message);
      }
    });
  }

  /** Recarga la página actual, los KPIs de cartera y los últimos cobros. */
  function recargar(paginaNueva = pagina, desde = fechaDesde, hasta = fechaHasta) {
    startRecargar(async () => {
      const [saldos, cobrosRes, carteraRes] = await Promise.all([
        listarSaldoPendiente({
          pagina: paginaNueva,
          porPagina: POR_PAGINA,
          fecha_desde: desde || undefined,
          fecha_hasta: hasta || undefined,
        }),
        ultimosPagos({ limite: 10 }),
        resumenCartera(),
      ]);
      if (saldos.ok) {
        setFacturas(saldos.data.facturas);
        setTotalPendientes(saldos.data.total);
        setPagina(paginaNueva);
      }
      if (cobrosRes.ok) setPagos(cobrosRes.data);
      if (carteraRes.ok) setCartera(carteraRes.data);
    });
  }

  function aplicarRango(desde: string, hasta: string) {
    setFechaDesde(desde);
    setFechaHasta(hasta);
    consultar(1, desde, hasta);
  }

  function cambiarPagina(nueva: number) {
    if (nueva < 1) return;
    consultar(nueva, fechaDesde, fechaHasta);
  }

  /** Trae todas las facturas abiertas del cliente (paginadas aparte) para asignar excedentes. */
  function cargarFacturasCliente(clienteId: string) {
    void listarSaldoPendiente({ cliente_id: clienteId, porPagina: 100 }).then((res) => {
      if (res.ok) setFacturasCliente(res.data.facturas);
    });
  }

  // Deep-link `?pedido=<facturaId>`: completa las facturas del cliente para el excedente.
  useEffect(() => {
    if (!pedidoFactura) return;
    let activo = true;
    void listarSaldoPendiente({ cliente_id: pedidoFactura.cliente_id, porPagina: 100 }).then((res) => {
      if (activo && res.ok) setFacturasCliente(res.data.facturas);
    });
    return () => {
      activo = false;
    };
  }, [pedidoFactura]);

  function abrirCobro(factura: SaldoPendiente) {
    setPago(factura);
    setMetodo("efectivo");
    setMonto(String(factura.saldo_usd));
    setTasa("");
    setReferencia("");
    setCorreo("");
    setFecha(fechaHoyISO());
    setAsignaciones({});
    setErrores({});
    // Semilla con la página visible y luego la lista completa del cliente.
    setFacturasCliente(facturasDelCliente(facturas, factura.cliente_id));
    cargarFacturasCliente(factura.cliente_id);
  }

  /** Cierra el modal de cobro y quita `?pedido=` de la URL para no reabrirlo. */
  function cerrarCobro() {
    setPago(null);
    if (window.location.search.includes("pedido=")) {
      const params = new URLSearchParams(window.location.search);
      params.delete("pedido");
      const query = params.toString();
      window.history.replaceState(null, "", `/cobranza${query ? `?${query}` : ""}`);
    }
  }

  function cambiarMetodo(nuevo: MetodoPago) {
    setMetodo(nuevo);
    // Referencia y correo solo aplican a ciertos métodos: se limpian los que no.
    if (nuevo === "efectivo") setReferencia("");
    if (nuevo !== "zelle" && nuevo !== "binance") setCorreo("");
  }

  function guardarPago(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!pago) return;
    setErrores({});
    startGuardar(async () => {
      const comunes = {
        metodo,
        tasa_cambio: esBs && tasa !== "" ? Number(tasa) : undefined,
        referencia: esEfectivo || referencia.trim() === "" ? undefined : referencia.trim(),
        correo: correo.trim() === "" ? undefined : correo.trim(),
        fecha: fecha === "" ? undefined : fecha,
      };

      if (requiereAsignacion) {
        if (!validacionAsignacion.valido) return;
        const res = await procesarPagoAsignado({
          ...comunes,
          asignaciones: [
            { factura_id: pago.factura_id, monto_usd: pago.saldo_usd },
            ...otrasFacturas
              .map((f) => ({
                factura_id: f.factura_id,
                monto_usd: Number(asignaciones[f.factura_id]) || 0,
              }))
              .filter((a) => a.monto_usd > 0),
          ],
        });
        if (!res.ok) {
          setErrores(res.error.fieldErrors ?? {});
          toast.error(res.error.message);
          return;
        }
      } else {
        const res = await procesarPago({
          factura_id: pago.factura_id,
          monto: montoNum,
          ...comunes,
        });
        if (!res.ok) {
          setErrores(res.error.fieldErrors ?? {});
          toast.error(res.error.message);
          return;
        }
      }

      cerrarCobro();
      toast.success("Pago registrado y saldo actualizado");
      // Refresca la página, los KPIs de cartera y los últimos cobros desde la BD.
      recargar();
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
          <span className="text-body-sm tabular-nums text-on-surface-variant">{totalPendientes}</span>
        </div>
        <div className="mb-3">
          <FiltroFechas
            desde={fechaDesde}
            hasta={fechaHasta}
            onAplicar={aplicarRango}
            onLimpiar={() => aplicarRango("", "")}
            cargando={recargando}
          />
        </div>
        {facturas.length === 0 && !recargando ? (
          <EmptyState
            icon={filtrando ? "search_off" : "check_circle"}
            title={filtrando ? "Sin resultados" : "Sin saldos pendientes"}
            description={
              filtrando
                ? "No hay facturas pendientes emitidas en ese rango de fechas."
                : "Todas las facturas están al día. En esta sección verás cuentas por cobrar."
            }
            action={
              filtrando ? (
                <Button variant="secondary" onClick={() => aplicarRango("", "")}>
                  Limpiar filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Card contentClassName={cn("p-0 transition-opacity", recargando && "pointer-events-none opacity-60")}>
              <ul className="divide-y divide-outline-variant">
                {facturas.map((factura) => (
                  <FilaFactura
                    key={factura.factura_id}
                    factura={factura}
                    onVerDetalle={() => setDetalle(factura)}
                    accionCobro={
                      <Button
                        size="sm"
                        icon="payments"
                        onClick={() => abrirCobro(factura)}
                        aria-label={`Cobrar factura ${factura.numero_factura}`}
                        className="shrink-0"
                      >
                        <span className="hidden sm:inline">Cobrar</span>
                      </Button>
                    }
                  />
                ))}
              </ul>
            </Card>
            <Pagination
              pagina={pagina}
              total={totalPendientes}
              porPagina={POR_PAGINA}
              onCambiar={cambiarPagina}
              cargando={recargando}
            />
          </>
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
        onClose={cerrarCobro}
        title={pago ? `Cobrar factura ${pago.numero_factura}` : ""}
        size="sm"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" className="w-full sm:flex-1" disabled={guardando} onClick={cerrarCobro}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-pago"
              icon="payments"
              loading={guardando}
              disabled={guardando || (requiereAsignacion && !validacionAsignacion.valido)}
              className="w-full sm:flex-1"
            >
              Registrar pago
            </Button>
          </div>
        }
      >
        {pago && (
          <form id="form-pago" onSubmit={guardarPago} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2 rounded-xl bg-surface-container px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-label-md text-on-surface-variant">Saldo pendiente</span>
                <span className="text-label-lg tabular-nums text-on-surface">{formatUsd(pago.saldo_usd)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-label-md text-on-surface-variant">Deuda total del cliente</span>
                <span className="text-label-md tabular-nums text-on-surface-variant">{formatUsd(deudaCliente)}</span>
              </div>
            </div>

            <Select
              label="Método de pago"
              name="metodo"
              value={metodo}
              onChange={(e) => cambiarMetodo(e.target.value as MetodoPago)}
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

            {!esEfectivo && (
              <Input
                label="Referencia"
                name="referencia"
                placeholder="Últimos 6 dígitos (Ej. 001234)"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                error={errores.referencia}
                hint={
                  esBs || esDigital
                    ? "Obligatoria. Se comparan los últimos 6 dígitos; si tiene menos, complete con 0 a la izquierda."
                    : undefined
                }
              />
            )}

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

            {requiereAsignacion && (
              <div className="flex flex-col gap-3 rounded-xl border border-outline-variant p-4">
                <div className="flex items-center justify-between">
                  <span className="text-label-md text-on-surface-variant">Excedente a asignar</span>
                  <span className="text-label-lg tabular-nums text-primary">{formatUsd(excedente)}</span>
                </div>
                {otrasFacturas.length === 0 ? (
                  <p className="text-body-sm text-error">
                    El cliente no tiene otras facturas abiertas para asignar el excedente.
                  </p>
                ) : (
                  <>
                    <p className="text-body-sm text-on-surface-variant">
                      Reparte el excedente entre las demás facturas del cliente (montos en USD).
                    </p>
                    <ul className="flex flex-col gap-3">
                      {otrasFacturas.map((factura) => (
                        <li key={factura.factura_id} className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-label-md tabular-nums text-on-surface">
                              {factura.numero_factura}
                            </p>
                            <p className="text-body-sm text-on-surface-variant">
                              Saldo {formatUsd(factura.saldo_usd)}
                            </p>
                          </div>
                          <div className="w-28 shrink-0">
                            <Input
                              name={`asign_${factura.factura_id}`}
                              type="number"
                              min={0}
                              max={factura.saldo_usd}
                              step="0.01"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={asignaciones[factura.factura_id] ?? ""}
                              onChange={(e) =>
                                setAsignaciones((prev) => ({
                                  ...prev,
                                  [factura.factura_id]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p
                      className={cn(
                        "text-body-sm tabular-nums",
                        validacionAsignacion.valido ? "text-primary" : "text-on-surface-variant"
                      )}
                    >
                      {validacionAsignacion.valido
                        ? "Excedente asignado por completo."
                        : `Falta por asignar ${formatUsd(validacionAsignacion.restante)}`}
                    </p>
                  </>
                )}
              </div>
            )}
          </form>
        )}
      </Modal>

      <FacturaDetalleModal
        factura={
          detalle
            ? {
                id: detalle.factura_id,
                numero_factura: detalle.numero_factura,
                estado: detalle.estado,
                total_usd: detalle.total_usd,
                total_pagado_usd: detalle.total_pagado_usd,
                saldo_usd: detalle.saldo_usd,
              }
            : null
        }
        onClose={() => setDetalle(null)}
        accion={
          detalle ? (
            <Button
              icon="payments"
              className="w-full"
              onClick={() => {
                const factura = detalle;
                setDetalle(null);
                abrirCobro(factura);
              }}
            >
              Registrar pago
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}