"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarVendedor,
  crearVendedor,
  eliminarVendedor,
  historialVendedor,
  pagarComisionVendedor,
  resumenVendedores,
} from "@/features/vendedores/actions";
import type {
  FacturaVendedor,
  VendedorResumen,
} from "@/features/vendedores/schemas";
import { round2 } from "@/lib/currency";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { EstadoChip } from "@/components/ui/estado-chip";
import { FiltroFechas } from "@/components/ui/filtro-fechas";
import { formatFecha, formatUsd } from "@/components/ui/format";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { ListSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";

type Rango = { desde: string; hasta: string };

type VendedorForm = {
  nombre: string;
  comision_pct: string;
  activo: boolean;
};

const FORM_VACIO: VendedorForm = {
  nombre: "",
  comision_pct: "0",
  activo: true,
};

const POR_PAGINA_HISTORIAL = 10;
const TOLERANCIA_SALDO = 0.005;

const METODOS_PAGO = [
  { value: "efectivo", label: "Efectivo" },
  { value: "bs", label: "Bolívares" },
  { value: "zelle", label: "Zelle" },
  { value: "binance", label: "Binance" },
] as const;

type MetodoPagoComision = (typeof METODOS_PAGO)[number]["value"];

function hoyCaracas(): string {
  try {
    return new Date().toLocaleDateString("sv-SE");
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatPct(valor: number): string {
  return `${new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 }).format(valor)} %`;
}

function Dato({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-lg p-3", highlight ? "bg-primary/5" : "bg-surface-container")}>
      <p className={cn("text-label-sm", highlight ? "text-primary" : "text-on-surface-variant")}>
        {label}
      </p>
      <p className="mt-0.5 text-label-lg tabular-nums text-on-surface">{value}</p>
      {sub && <p className="text-body-sm text-on-surface-variant">{sub}</p>}
    </div>
  );
}

export function VendedoresApp({
  datosIniciales,
  rangoInicial,
  errorMensaje,
}: {
  datosIniciales: VendedorResumen[];
  rangoInicial: Rango;
  errorMensaje?: string;
}) {
  const toast = useToast();
  const router = useRouter();

  const [vendedores, setVendedores] = useState<VendedorResumen[]>(datosIniciales);
  const [rango, setRango] = useState<Rango>(rangoInicial);
  const [busqueda, setBusqueda] = useState("");
  const [cargandoPeriodo, startCargarPeriodo] = useTransition();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<VendedorResumen | null>(null);
  const [form, setForm] = useState<VendedorForm>(FORM_VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, startGuardar] = useTransition();

  const [eliminar, setEliminar] = useState<VendedorResumen | null>(null);
  const [eliminando, startEliminar] = useTransition();

  const [vendedorHistorial, setVendedorHistorial] = useState<VendedorResumen | null>(null);
  const [facturasHistorial, setFacturasHistorial] = useState<FacturaVendedor[]>([]);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [totalHistorial, setTotalHistorial] = useState(0);
  const [cargandoHistorial, startCargarHistorial] = useTransition();
  const solicitudHistorialRef = useRef(0);

  const [comisionFactura, setComisionFactura] = useState<FacturaVendedor | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPagoComision>("efectivo");
  const [montoPago, setMontoPago] = useState("");
  const [tasaCambio, setTasaCambio] = useState("");
  const [referencia, setReferencia] = useState("");
  const [correo, setCorreo] = useState("");
  const [fechaPago, setFechaPago] = useState(hoyCaracas());
  const [erroresComision, setErroresComision] = useState<Record<string, string>>({});
  const [pagandoComision, startPagarComision] = useTransition();

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return vendedores;
    return vendedores.filter((v) => v.nombre.toLowerCase().includes(texto));
  }, [busqueda, vendedores]);

  const activos = vendedores.filter((v) => v.activo).length;
  const facturasPeriodo = vendedores.reduce((total, v) => total + v.facturas_periodo, 0);
  const pagadasPeriodo = vendedores.reduce((total, v) => total + v.pagadas_periodo, 0);
  const comisionTotal = vendedores.reduce((total, v) => total + v.comision_total_usd, 0);
  const filtrando = busqueda.trim() !== "";

  const montoComision = comisionFactura?.comision_usd ?? 0;

  const esBs = metodoPago === "bs";
  const esDigital = metodoPago === "zelle" || metodoPago === "binance";
  const montoPagoNum = Number(montoPago.trim().replace(",", "."));
  const tasaCambioNum = Number(tasaCambio.trim().replace(",", "."));
  const montoUsdDesdeBs =
    esBs && Number.isFinite(montoPagoNum) && Number.isFinite(tasaCambioNum) && tasaCambioNum > 0
      ? round2(montoPagoNum / tasaCambioNum)
      : null;

  function sincronizarUrl(desde: string, hasta: string) {
    const params = new URLSearchParams();
    params.set("desde", desde);
    params.set("hasta", hasta);
    router.replace(`/vendedores?${params.toString()}`, { scroll: false });
  }

  function consultar(desde: string, hasta: string) {
    startCargarPeriodo(async () => {
      const res = await resumenVendedores({ desde, hasta });
      if (res.ok) setVendedores(res.data);
      else toast.error(res.error.message);
    });
  }

  function aplicarRango(desde: string, hasta: string) {
    setRango({ desde, hasta });
    sincronizarUrl(desde, hasta);
    consultar(desde, hasta);
  }

  async function refrescarResumen() {
    const lista = await resumenVendedores(rango);
    if (!lista.ok) {
      toast.error(lista.error.message);
      return;
    }
    setVendedores(lista.data);
    setVendedorHistorial((actual) =>
      actual ? (lista.data.find((v) => v.id === actual.id) ?? actual) : actual
    );
  }

  function cargarHistorial(vendedorId: string, pagina: number) {
    const solicitud = ++solicitudHistorialRef.current;
    startCargarHistorial(async () => {
      const res = await historialVendedor({
        vendedor_id: vendedorId,
        pagina,
        porPagina: POR_PAGINA_HISTORIAL,
      });
      if (solicitud !== solicitudHistorialRef.current) return;
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setFacturasHistorial(res.data.facturas);
      setTotalHistorial(res.data.total);
      setPaginaHistorial(pagina);
    });
  }

  function abrirHistorial(vendedor: VendedorResumen) {
    setVendedorHistorial(vendedor);
    setFacturasHistorial([]);
    setTotalHistorial(0);
    setPaginaHistorial(1);
    cargarHistorial(vendedor.id, 1);
  }

  function cerrarHistorial() {
    solicitudHistorialRef.current += 1;
    setVendedorHistorial(null);
    setFacturasHistorial([]);
    setTotalHistorial(0);
    setPaginaHistorial(1);
  }

  function abrirPagoComision(factura: FacturaVendedor) {
    setComisionFactura(factura);
    setMetodoPago("efectivo");
    setMontoPago(factura.comision_usd > 0 ? String(round2(factura.comision_usd)) : "");
    setTasaCambio("");
    setReferencia("");
    setCorreo("");
    setFechaPago(hoyCaracas());
    setErroresComision({});
  }

  function cerrarPagoComision() {
    setComisionFactura(null);
    setMetodoPago("efectivo");
    setMontoPago("");
    setTasaCambio("");
    setReferencia("");
    setCorreo("");
    setFechaPago(hoyCaracas());
    setErroresComision({});
  }

  function pagarComision(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!comisionFactura) return;
    setErroresComision({});

    const vendedorId = vendedorHistorial?.id;
    const paginaActual = paginaHistorial;

    startPagarComision(async () => {
      const payload: Record<string, unknown> = {
        factura_id: comisionFactura.factura_id,
        metodo: metodoPago,
        monto: montoPago,
        fecha: fechaPago,
      };

      if (esBs) {
        payload.tasa_cambio = tasaCambio;
        payload.referencia = referencia;
      }
      if (esDigital) {
        payload.correo = correo;
        payload.referencia = referencia;
      }

      const res = await pagarComisionVendedor(payload);
      if (!res.ok) {
        setErroresComision(res.error.fieldErrors ?? {});
        toast.error(res.error.message);
        return;
      }

      toast.success("Comisión registrada como pagada");
      cerrarPagoComision();
      await refrescarResumen();
      if (vendedorId) cargarHistorial(vendedorId, paginaActual);
    });
  }

  function abrirNuevo() {
    setEditando(null);
    setForm(FORM_VACIO);
    setErrores({});
    setModalAbierto(true);
  }

  function abrirEditar(vendedor: VendedorResumen) {
    setEditando(vendedor);
    setForm({
      nombre: vendedor.nombre,
      comision_pct: String(vendedor.comision_pct),
      activo: vendedor.activo,
    });
    setErrores({});
    setModalAbierto(true);
  }

  function setCampo<K extends keyof VendedorForm>(campo: K, valor: VendedorForm[K]) {
    setForm((actual) => ({ ...actual, [campo]: valor }));
  }

  function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrores({});
    startGuardar(async () => {
      const payload = {
        nombre: form.nombre,
        comision_pct: form.comision_pct,
        activo: form.activo,
      };

      const res = editando
        ? await actualizarVendedor({ id: editando.id, ...payload })
        : await crearVendedor(payload);

      if (!res.ok) {
        setErrores(res.error.fieldErrors ?? {});
        toast.error(res.error.message);
        return;
      }

      setModalAbierto(false);
      toast.success(editando ? "Vendedor actualizado" : "Vendedor creado");
      await refrescarResumen();
    });
  }

  function confirmarEliminar() {
    if (!eliminar) return;
    startEliminar(async () => {
      const res = await eliminarVendedor(eliminar.id);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      setEliminar(null);
      toast.success("Vendedor eliminado");
      await refrescarResumen();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {errorMensaje && <Alert tone="error">{errorMensaje}</Alert>}

      <div className="flex items-center gap-2">
        <SearchInput
          placeholder="Buscar vendedor"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar vendedor"
        />
        <Button onClick={abrirNuevo} icon="add" className="shrink-0" aria-label="Nuevo vendedor">
          <span className="hidden sm:inline">Nuevo</span>
        </Button>
      </div>

      <FiltroFechas
        desde={rango.desde}
        hasta={rango.hasta}
        onAplicar={aplicarRango}
        onLimpiar={() => aplicarRango("", "")}
        cargando={cargandoPeriodo}
      />

      <div
        className={cn(
          "grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-4",
          cargandoPeriodo && "opacity-60"
        )}
      >
        <StatCard
          compact
          label="Vendedores activos"
          value={activos}
          icon="person"
          tone="bg-primary/10 text-primary"
        />
        <StatCard
          compact
          label="Facturas del período"
          value={facturasPeriodo}
          icon="receipt_long"
          tone="bg-primary/10 text-primary"
        />
        <StatCard
          compact
          label="Pagadas del período"
          value={pagadasPeriodo}
          icon="check_circle"
          tone="bg-status-pagada-bg text-status-pagada-text"
        />
        <StatCard
          compact
          label="Comisión total"
          value={formatUsd(comisionTotal)}
          icon="payments"
          tone="bg-status-pagada-bg text-status-pagada-text"
        />
      </div>

      <p className="text-body-sm text-on-surface-variant">
        La comisión total suma lo pagado y la estimación pendiente con el % actual. El filtro de
        fechas solo afecta las métricas del período.
      </p>

      {vendedores.length === 0 ? (
        <EmptyState
          icon="person"
          title="Sin vendedores"
          description="Crea tu primer vendedor para asignarlo a los clientes y calcular comisiones."
          action={<Button onClick={abrirNuevo} icon="add">Nuevo vendedor</Button>}
        />
      ) : visibles.length === 0 ? (
        <EmptyState
          icon="search"
          title="Sin resultados"
          description={`No hay vendedores que coincidan con “${busqueda}”.`}
          action={
            <Button variant="secondary" onClick={() => setBusqueda("")}>
              Limpiar búsqueda
            </Button>
          }
        />
      ) : (
        <Card contentClassName="p-0">
          <ul className={cn("divide-y divide-outline-variant transition-opacity", cargandoPeriodo && "opacity-60")}>
            {visibles.map((vendedor) => (
              <li key={vendedor.id} className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-label-lg text-primary">
                    {vendedor.nombre.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-label-lg text-on-surface">{vendedor.nombre}</p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-label-sm",
                          vendedor.activo
                            ? "bg-status-pagada-bg text-status-pagada-text"
                            : "bg-surface-container text-on-surface-variant"
                        )}
                      >
                        {vendedor.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p className="text-body-sm text-on-surface-variant">
                      Comisión actual: {formatPct(vendedor.comision_pct)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => abrirEditar(vendedor)}
                      aria-label={`Editar ${vendedor.nombre}`}
                      title="Editar vendedor"
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <Icon name="edit" size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEliminar(vendedor)}
                      aria-label={`Eliminar ${vendedor.nombre}`}
                      title="Eliminar vendedor"
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error-container hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
                    >
                      <Icon name="delete" size={18} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1.3fr_1fr]">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Dato
                      highlight
                      label="Comisión pagada"
                      value={formatUsd(vendedor.comision_pagada_usd)}
                      sub={`${vendedor.comisiones_pagadas} comisiones registradas`}
                    />
                    <Dato
                      label="Pendiente asignada"
                      value={formatUsd(vendedor.comision_pendiente_usd)}
                      sub={`${vendedor.pagadas_total} de ${vendedor.facturas_total} facturas pagadas`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Dato
                      label="Facturas"
                      value={vendedor.facturas_periodo}
                      sub={`${vendedor.pagadas_periodo} pagadas`}
                    />
                    <Dato label="Vendido" value={formatUsd(vendedor.vendido_periodo_usd)} />
                    <Dato label="Cobrado" value={formatUsd(vendedor.cobrado_periodo_usd)} />
                    <Dato label="Saldo" value={formatUsd(vendedor.saldo_periodo_usd)} />
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="receipt_long"
                    className="w-full sm:w-auto"
                    onClick={() => abrirHistorial(vendedor)}
                  >
                    Ver facturas
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-outline-variant px-5 py-2.5 text-body-sm text-on-surface-variant">
            {visibles.length} vendedor{visibles.length === 1 ? "" : "es"}
            {filtrando ? ` de ${vendedores.length}` : ""}
          </p>
        </Card>
      )}

      <Modal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        title={editando ? "Editar vendedor" : "Nuevo vendedor"}
        size="md"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              className="w-full sm:flex-1"
              disabled={guardando}
              onClick={() => setModalAbierto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-vendedor"
              icon="save"
              loading={guardando}
              className="w-full sm:flex-1"
            >
              Guardar
            </Button>
          </div>
        }
      >
        <form id="form-vendedor" onSubmit={guardar} className="flex flex-col gap-4" noValidate>
          <Input
            label="Nombre"
            name="nombre"
            placeholder="Nombre del vendedor"
            value={form.nombre}
            onChange={(e) => setCampo("nombre", e.target.value)}
            error={errores.nombre}
            icon="person"
            autoComplete="off"
            required
          />
          <Input
            label="Comisión (%)"
            name="comision_pct"
            inputMode="decimal"
            placeholder="0,00"
            value={form.comision_pct}
            onChange={(e) => setCampo("comision_pct", e.target.value)}
            error={errores.comision_pct}
            hint="Se aplica sobre el total de las facturas totalmente pagadas."
          />
          <Select
            label="Estado"
            name="activo"
            options={[
              { value: "true", label: "Activo" },
              { value: "false", label: "Inactivo" },
            ]}
            value={form.activo ? "true" : "false"}
            onChange={(e) => setCampo("activo", e.target.value === "true")}
          />
          <p className="rounded-lg bg-surface-container p-3 text-body-sm text-on-surface-variant">
            El porcentaje se usa para asignar comisiones a las nuevas facturas. Las facturas ya
            emitidas conservan su porcentaje y monto.
          </p>
        </form>
      </Modal>

      <Modal
        open={vendedorHistorial !== null}
        onClose={cerrarHistorial}
        title="Historial de facturas"
        size="lg"
        footer={
          <Button variant="secondary" className="w-full" onClick={cerrarHistorial}>
            Cerrar
          </Button>
        }
      >
        {vendedorHistorial && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-headline-sm text-on-surface">{vendedorHistorial.nombre}</p>
              <p className="text-body-sm text-on-surface-variant">
                Comisión base del vendedor: {formatPct(vendedorHistorial.comision_pct)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Dato
                highlight
                label="Comisión pagada"
                value={formatUsd(vendedorHistorial.comision_pagada_usd)}
              />
              <Dato
                label="Pendiente asignada"
                value={formatUsd(vendedorHistorial.comision_pendiente_usd)}
              />
              <Dato label="Facturas pagadas" value={vendedorHistorial.pagadas_total} />
              <Dato label="Comisiones pagadas" value={vendedorHistorial.comisiones_pagadas} />
            </div>

            <p className="rounded-lg bg-surface-container p-3 text-body-sm text-on-surface-variant">
              El porcentaje y el monto se asignan al crear la factura. Cambiar el % del vendedor
              no afecta facturas ya emitidas.
            </p>

            {cargandoHistorial && facturasHistorial.length === 0 ? (
              <ListSkeleton rows={3} />
            ) : totalHistorial === 0 ? (
              <EmptyState
                icon="receipt_long"
                title="Sin facturas"
                description="Este vendedor todavía no tiene facturas emitidas."
              />
            ) : (
              <>
                <ul
                  className={cn(
                    "divide-y divide-outline-variant rounded-xl border border-outline-variant transition-opacity",
                    cargandoHistorial && "opacity-60"
                  )}
                >
                  {facturasHistorial.map((factura) => {
                    const comision = factura.comision;
                    const facturaPagada = factura.saldo_usd <= TOLERANCIA_SALDO;
                    const tieneComision = factura.comision_usd > 0;

                    return (
                      <li key={factura.factura_id} className="p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-label-lg tabular-nums text-on-surface">
                              {factura.numero_factura}
                            </p>
                            <p className="truncate text-body-sm text-on-surface-variant">
                              {factura.nombre_juridico}
                            </p>
                            <p className="text-body-sm tabular-nums text-on-surface-variant">
                              {formatFecha(factura.fecha_emision)} · {formatUsd(factura.total_usd)}
                            </p>
                          </div>
                          <EstadoChip estado={factura.estado} className="shrink-0" />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-container p-3">
                        {comision ? (
                          <>
                            <div>
                              <p className="text-label-sm text-on-surface-variant">
                                Comisión pagada
                              </p>
                              <p className="text-label-lg tabular-nums text-on-surface">
                                {formatUsd(comision.monto_usd)}{" "}
                                <span className="text-body-sm text-on-surface-variant">
                                  ({formatPct(comision.comision_pct)})
                                </span>
                              </p>
                              <p className="text-body-sm text-on-surface-variant">
                                {comision.metodo === "bs"
                                  ? `Bs ${Number(comision.monto_original).toLocaleString("es-VE")} (${comision.tasa_cambio ? Number(comision.tasa_cambio).toLocaleString("es-VE") : "-"})`
                                  : `${comision.moneda} ${Number(comision.monto_original).toLocaleString("es-VE")}`} · {formatFecha(comision.fecha)}
                                {comision.referencia ? ` · Ref. ${comision.referencia}` : ""}
                              </p>
                            </div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-status-pagada-bg px-2.5 py-1 text-label-md text-status-pagada-text">
                              <Icon name="check_circle" size={14} strokeWidth={2.2} />
                              Pagada
                            </span>
                          </>
                        ) : tieneComision ? (
                          <>
                            <div>
                              <p className="text-label-sm text-on-surface-variant">
                                Comisión asignada
                              </p>
                              <p className="text-label-lg tabular-nums text-on-surface">
                                {formatUsd(factura.comision_usd)}{" "}
                                <span className="text-body-sm text-on-surface-variant">
                                  ({formatPct(factura.comision_pct)})
                                </span>
                              </p>
                              {!facturaPagada && (
                                <p className="text-body-sm text-on-surface-variant">
                                  Disponible cuando la factura esté totalmente pagada. Saldo:{" "}
                                  {formatUsd(factura.saldo_usd)}
                                </p>
                              )}
                            </div>
                            {facturaPagada && (
                              <Button
                                size="sm"
                                onClick={() => abrirPagoComision(factura)}
                                icon="payments"
                              >
                                Pagar comisión
                              </Button>
                            )}
                          </>
                        ) : (
                          <p className="text-body-sm text-on-surface-variant">
                            Esta factura no tiene comisión asignada.
                          </p>
                        )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <Pagination
                  pagina={paginaHistorial}
                  total={totalHistorial}
                  porPagina={POR_PAGINA_HISTORIAL}
                  onCambiar={(pagina) =>
                    vendedorHistorial && cargarHistorial(vendedorHistorial.id, pagina)
                  }
                  cargando={cargandoHistorial}
                />
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={comisionFactura !== null}
        onClose={cerrarPagoComision}
        title="Pagar comisión"
        size="md"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              className="w-full sm:flex-1"
              disabled={pagandoComision}
              onClick={cerrarPagoComision}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-pago-comision"
              className="w-full sm:flex-1"
              icon="check"
              loading={pagandoComision}
            >
              Registrar pago
            </Button>
          </div>
        }
      >
        {comisionFactura && (
          <form
            id="form-pago-comision"
            onSubmit={pagarComision}
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="rounded-lg bg-surface-container p-3">
              <p className="text-label-sm text-on-surface-variant">Factura</p>
              <p className="text-label-lg tabular-nums text-on-surface">
                {comisionFactura.numero_factura} · {comisionFactura.nombre_juridico}
              </p>
              <p className="text-body-sm tabular-nums text-on-surface-variant">
                Total factura: {formatUsd(comisionFactura.total_usd)} · Comisión asignada:{" "}
                {formatPct(comisionFactura.comision_pct)}
              </p>
            </div>

            <Input
              label="Fecha de pago"
              name="fecha"
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              error={erroresComision.fecha}
            />

            <div className="rounded-lg bg-primary/5 p-3">
              <p className="text-label-sm text-primary">Comisión asignada a pagar</p>
              <p className="mt-0.5 text-numeric-currency tabular-nums text-primary">
                {formatUsd(montoComision)}
              </p>
            </div>

            <Select
              label="Método de pago"
              name="metodo"
              options={[...METODOS_PAGO]}
              value={metodoPago}
              onChange={(e) => {
                const nuevoMetodo = e.target.value as MetodoPagoComision;
                setMetodoPago(nuevoMetodo);
                setMontoPago(
                  nuevoMetodo === "bs" || !comisionFactura
                    ? ""
                    : String(round2(comisionFactura.comision_usd))
                );
                setErroresComision({});
              }}
              error={erroresComision.metodo}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label={esBs ? "Monto pagado (Bs)" : "Monto pagado (USD)"}
                name="monto"
                inputMode="decimal"
                placeholder={esBs ? "0,00" : "0,00"}
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                error={erroresComision.monto}
              />
              {esBs && (
                <Input
                  label="Tasa de cambio"
                  name="tasa_cambio"
                  inputMode="decimal"
                  placeholder="0,0000"
                  value={tasaCambio}
                  onChange={(e) => setTasaCambio(e.target.value)}
                  error={erroresComision.tasa_cambio}
                />
              )}
            </div>

            {esBs && montoUsdDesdeBs !== null && (
              <p className="text-body-sm text-on-surface-variant">
                Equivale a {formatUsd(montoUsdDesdeBs)} USD
              </p>
            )}

            {esBs && (
              <Input
                label="Referencia"
                name="referencia"
                placeholder="Nro. de referencia"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                error={erroresComision.referencia}
              />
            )}

            {esDigital && (
              <>
                <Input
                  label="Correo"
                  name="correo"
                  placeholder="correo@ejemplo.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  error={erroresComision.correo}
                />
                <Input
                  label="Referencia"
                  name="referencia"
                  placeholder="ID / hash de transferencia"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  error={erroresComision.referencia}
                />
              </>
            )}

            <p className="text-body-sm text-on-surface-variant">
              El monto asignado a esta factura no cambia. El detalle del pago se guarda como en el
              cobro de facturas.
            </p>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="¿Eliminar vendedor?"
        description={`“${eliminar?.nombre ?? ""}” se quitará de la lista. No se elimina si tiene clientes o facturas; en ese caso puedes desactivarlo.`}
        confirmLabel="Eliminar"
        danger
        loading={eliminando}
      />
    </div>
  );
}
