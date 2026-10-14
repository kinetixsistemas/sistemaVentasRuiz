"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { crearFactura, listarFacturas, resumenVentas } from "@/features/ventas/actions";
import type { Cliente } from "@/features/clientes/schemas";
import type { Producto } from "@/features/inventario/schemas";
import type { FacturaConSaldo, ResumenCartera, ResumenVentas } from "@/features/ventas/schemas";
import type { EstadoFactura } from "@/types/database";
import { calcularTotal } from "@/features/ventas/schemas";
import { round2 } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { EstadoChip, estadoFacturaLabel } from "@/components/ui/estado-chip";
import { Icon } from "@/components/ui/icon";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { Select, type SelectOption } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";
import { formatFecha, formatUsd, labelCondicion } from "@/components/ui/format";
import { FacturaDetalleModal } from "./factura-detalle-modal";

type ItemForm = { producto_id: string; cantidad: string; precio: string; stock: number };
type FiltroEstado = EstadoFactura | "todas";
type Periodo = { desde: string; hasta: string };
type DescuentoCampo = { monto: string; pct: string; fuente: "monto" | "pct" };

const ITEM_VACIO: ItemForm = { producto_id: "", cantidad: "1", precio: "", stock: 0 };

const DIAS_CREDITO_OPCIONES: SelectOption[] = [
  { value: "7", label: "7 días" },
  { value: "15", label: "15 días" },
  { value: "30", label: "30 días" },
];

const FILTROS_ESTADO: { value: FiltroEstado; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "pendiente", label: estadoFacturaLabel.pendiente },
  { value: "por_vencer", label: estadoFacturaLabel.por_vencer },
  { value: "vencida", label: estadoFacturaLabel.vencida },
  { value: "pagada", label: estadoFacturaLabel.pagada },
];

/** Normaliza un texto numérico aceptando coma o punto decimal. */
function numeroDeTexto(valor: string): number {
  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Mes anterior/siguiente a partir del primer día del período. */
function moverPeriodo(periodo: Periodo, delta: number): Periodo {
  const [anio, mes] = periodo.desde.split("-").map(Number);
  let nuevoAnio = anio!;
  let nuevoMes = mes! + delta;
  if (nuevoMes < 1) {
    nuevoMes = 12;
    nuevoAnio -= 1;
  }
  if (nuevoMes > 12) {
    nuevoMes = 1;
    nuevoAnio += 1;
  }
  const mm = String(nuevoMes).padStart(2, "0");
  const ultimoDia = new Date(nuevoAnio, nuevoMes, 0).getDate();
  return { desde: `${nuevoAnio}-${mm}-01`, hasta: `${nuevoAnio}-${mm}-${String(ultimoDia).padStart(2, "0")}` };
}

/** Etiqueta legible del período, p. ej. "Octubre 2026". */
function etiquetaPeriodo(periodo: Periodo): string {
  const [anio, mes] = periodo.desde.split("-").map(Number);
  const texto = new Intl.DateTimeFormat("es-VE", { month: "long", year: "numeric" }).format(
    new Date(anio!, mes! - 1, 1)
  );
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function VentasApp({
  facturas,
  resumen,
  clientes,
  productos,
  abrirNueva = false,
  periodoInicial,
  periodoActual,
  resumenVentasInicial,
  errorMensaje,
}: {
  facturas: FacturaConSaldo[];
  resumen?: ResumenCartera | null;
  clientes: Cliente[];
  productos: Producto[];
  /** Abre el modal de nueva venta al cargar (deep-link `/ventas?nueva=1`). */
  abrirNueva?: boolean;
  /** Mes mostrado en los KPIs (por defecto, el mes actual). */
  periodoInicial: Periodo;
  /** Mes actual según el servidor: limita la navegación a meses pasados. */
  periodoActual: Periodo;
  resumenVentasInicial?: ResumenVentas | null;
  errorMensaje?: string;
}) {
  const toast = useToast();

  const [facturasLocales, setFacturasLocales] = useState<FacturaConSaldo[]>(facturas);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<FiltroEstado>("todas");
  const [buscando, startBuscar] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [modalNueva, setModalNueva] = useState(abrirNueva);
  const [detalle, setDetalle] = useState<FacturaConSaldo | null>(null);

  const [periodo, setPeriodo] = useState<Periodo>(periodoInicial);
  const [resumenMes, setResumenMes] = useState<ResumenVentas | null>(resumenVentasInicial ?? null);
  const [cambiandoMes, startCambiarMes] = useTransition();

  const [clienteId, setClienteId] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [condicion, setCondicion] = useState<"contado" | "credito">("contado");
  const [diasCredito, setDiasCredito] = useState("7");
  const [items, setItems] = useState<ItemForm[]>([ITEM_VACIO]);
  const [descuento, setDescuento] = useState<DescuentoCampo>({ monto: "", pct: "", fuente: "monto" });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, startGuardar] = useTransition();

  const clientesOpciones: SelectOption[] = clientes.map((c) => ({ value: c.id, label: c.nombre_juridico }));
  const productosOpciones: SelectOption[] = productos.map((p) => ({
    value: p.id,
    label: `${p.codigo} — ${p.nombre}`,
  }));

  const subtotal = calcularTotal(
    items.map((i) => ({
      cantidad: Number(i.cantidad) || 0,
      precio_unitario_usd: Number(i.precio) || 0,
    }))
  );

  // Descuento espejo: lo que el usuario escribe manda; el otro campo se deriva
  // del subtotal actual, así que se mantiene coherente si cambian los ítems.
  const descuentoVista = useMemo(() => {
    if (descuento.fuente === "pct") {
      const pct = numeroDeTexto(descuento.pct);
      return {
        pct: descuento.pct,
        monto: descuento.pct.trim() === "" ? "" : String(round2((subtotal * pct) / 100)),
      };
    }
    const monto = numeroDeTexto(descuento.monto);
    return {
      monto: descuento.monto,
      pct:
        subtotal > 0 && descuento.monto.trim() !== ""
          ? String(round2((monto / subtotal) * 100))
          : "",
    };
  }, [descuento, subtotal]);

  const descuentoMonto = numeroDeTexto(descuentoVista.monto);
  const descuentoExcede = descuentoMonto > subtotal + 0.005;
  const totalEstimado = round2(Math.max(0, subtotal - descuentoMonto));

  const totalFacturasPendiente = facturasLocales.reduce((acc, f) => acc + f.saldo_usd, 0);
  const facturasAbiertas = resumen?.facturas_abiertas ?? facturasLocales.filter((f) => f.saldo_usd > 0).length;
  const porCobrar = resumen ? resumen.por_cobrar_usd : totalFacturasPendiente;
  const filtrando = estadoFiltro !== "todas" || busqueda.trim() !== "";
  const esMesActual = periodo.desde === periodoActual.desde;

  function consultar(estado: FiltroEstado, texto: string) {
    startBuscar(async () => {
      const res = await listarFacturas({
        estado,
        limite: 50,
        busqueda: texto.trim() || undefined,
      });
      if (res.ok) setFacturasLocales(res.data);
      else toast.error(res.error.message);
    });
  }

  // La búsqueda se resuelve en la BD (no se descarga el histórico completo).
  function cambiarBusqueda(valor: string) {
    setBusqueda(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => consultar(estadoFiltro, valor), 300);
  }

  function cambiarFiltroEstado(nuevo: FiltroEstado) {
    if (nuevo === estadoFiltro) return;
    setEstadoFiltro(nuevo);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    consultar(nuevo, busqueda);
  }

  function limpiarFiltros() {
    setBusqueda("");
    setEstadoFiltro("todas");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    consultar("todas", "");
  }

  function cambiarMes(delta: number) {
    const nuevo = moverPeriodo(periodo, delta);
    if (nuevo.desde > periodoActual.desde) return;
    setPeriodo(nuevo);
    startCambiarMes(async () => {
      const res = await resumenVentas(nuevo);
      if (res.ok) setResumenMes(res.data);
      else toast.error(res.error.message);
    });
  }

  function seleccionarProducto(idx: number, productoId: string) {
    const producto = productos.find((p) => p.id === productoId);
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx
          ? { ...item, producto_id: productoId, precio: String(producto?.precio_usd ?? ""), stock: producto?.cantidad ?? 0 }
          : item
      )
    );
  }

  function actualizarItem(idx: number, patch: Partial<ItemForm>) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }

  function agregarItem() {
    setItems((prev) => [...prev, { ...ITEM_VACIO }]);
  }

  function guardarFactura(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrores({});
    startGuardar(async () => {
      const res = await crearFactura({
        cliente_id: clienteId,
        numero_factura: numeroFactura,
        condicion,
        dias_credito: condicion === "contado" ? 0 : Number(diasCredito),
        descuento_usd: descuentoMonto,
        items: items
          .filter((i) => i.producto_id && Number(i.cantidad) > 0)
          .map((i) => ({
            producto_id: i.producto_id,
            cantidad: Number(i.cantidad),
            precio_unitario_usd: Number(i.precio),
          })),
      });

      if (!res.ok) {
        setErrores(res.error.fieldErrors ?? {});
        toast.error(res.error.message);
        return;
      }
      setModalNueva(false);
      setClienteId("");
      setNumeroFactura("");
      setCondicion("contado");
      setDiasCredito("7");
      setItems([ITEM_VACIO]);
      setDescuento({ monto: "", pct: "", fuente: "monto" });
      toast.success("Factura creada y stock descontado");

      // La factura recién creada es la más reciente: se antepone a la lista
      // sin volver a consultar el listado completo.
      setFacturasLocales((prev) => [res.data.factura, ...prev].slice(0, 50));
    });
  }

  function abrirDetalle(factura: FacturaConSaldo) {
    setDetalle(factura);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <SearchInput
          value={busqueda}
          onChange={(e) => cambiarBusqueda(e.target.value)}
          placeholder="Buscar factura, cliente o RIF…"
          aria-label="Buscar factura"
        />
        <Button onClick={() => setModalNueva(true)} icon="add" className="shrink-0">
          <span className="hidden sm:inline">Venta</span>
        </Button>
      </div>

      {errorMensaje && <Alert tone="error">{errorMensaje}</Alert>}

      <div
        role="group"
        aria-label="Filtrar por estado"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5"
      >
        {FILTROS_ESTADO.map((filtro) => (
          <button
            key={filtro.value}
            type="button"
            onClick={() => cambiarFiltroEstado(filtro.value)}
            aria-pressed={estadoFiltro === filtro.value}
            className={cn(
              "h-9 shrink-0 rounded-full px-3.5 text-label-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              estadoFiltro === filtro.value
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:text-on-surface"
            )}
          >
            {filtro.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          compact
          label="Facturas abiertas"
          value={facturasAbiertas}
          icon="receipt_long"
          tone="bg-primary/10 text-primary"
        />
        <StatCard
          compact
          label="Por cobrar"
          value={formatUsd(porCobrar)}
          icon="account_balance_wallet"
          tone="bg-primary/10 text-primary"
        />
      </div>

      <section className="flex flex-col gap-3" aria-label="Ventas del mes">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-label-lg text-on-surface-variant">Ventas del mes</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => cambiarMes(-1)}
              aria-label="Mes anterior"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Icon name="chevron_left" size={20} />
            </button>
            <span className="min-w-32 text-center text-label-md text-on-surface">{etiquetaPeriodo(periodo)}</span>
            <button
              type="button"
              onClick={() => cambiarMes(1)}
              disabled={esMesActual}
              aria-label="Mes siguiente"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Icon name="chevron_right" size={20} />
            </button>
          </div>
        </div>
        <div className={cn("grid grid-cols-2 gap-3 transition-opacity", cambiandoMes && "opacity-60")}>
          <StatCard
            compact
            label="Vendido"
            value={resumenMes ? formatUsd(resumenMes.total_vendido_usd) : "—"}
            icon="receipt_long"
            tone="bg-primary/10 text-primary"
          />
          <StatCard
            compact
            label="Recaudado"
            value={resumenMes ? formatUsd(resumenMes.total_recaudado_usd) : "—"}
            icon="payments"
            tone="bg-status-pagada-bg text-status-pagada-text"
          />
        </div>
      </section>

      {buscando ? (
        <p className="py-6 text-center text-body-sm text-on-surface-variant">Buscando…</p>
      ) : facturasLocales.length === 0 ? (
        <EmptyState
          icon="receipt_long"
          title={filtrando ? "Sin resultados" : "Sin facturas"}
          description={
            filtrando
              ? "No hay facturas que coincidan con los filtros."
              : "Registra tu primera venta para empezar a facturar."
          }
          action={
            filtrando ? (
              <Button onClick={limpiarFiltros} variant="secondary">Limpiar filtros</Button>
            ) : (
              <Button onClick={() => setModalNueva(true)} icon="add">Nueva venta</Button>
            )
          }
        />
      ) : (
        <Card contentClassName="p-0">
          <ul className="divide-y divide-outline-variant">
            {facturasLocales.map((factura) => (
              <li key={factura.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
                  <Icon name="receipt_long" size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="shrink-0 text-label-lg tabular-nums text-on-surface">
                      {factura.numero_factura}
                    </p>
                    <EstadoChip estado={factura.estado} className="hidden sm:inline-flex" />
                  </div>
                  <p className="truncate text-body-sm text-on-surface-variant">
                    {factura.nombre_juridico} · {formatFecha(factura.fecha_emision)} · {labelCondicion(factura.condicion)}
                    {factura.saldo_usd > 0 && (
                      <span className="tabular-nums"> · Saldo {formatUsd(factura.saldo_usd)}</span>
                    )}
                  </p>
                </div>
                {factura.saldo_usd > 0 && (
                  <Button
                    href={`/cobranza?pedido=${factura.id}`}
                    size="sm"
                    icon="payments"
                    aria-label={`Cobrar factura ${factura.numero_factura}`}
                    className="shrink-0"
                  >
                    <span className="hidden sm:inline">Cobrar</span>
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => abrirDetalle(factura)}
                  aria-label={`Ver detalle de factura ${factura.numero_factura}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Icon name="chevron_right" size={20} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={modalNueva}
        onClose={() => setModalNueva(false)}
        title="Nueva venta"
        size="md"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 text-label-md text-on-surface-variant">
              {descuentoMonto > 0 ? (
                <>
                  Subtotal <span className="tabular-nums">{formatUsd(subtotal)}</span> · Descuento{" "}
                  <span className="tabular-nums">−{formatUsd(descuentoMonto)}</span> · Total{" "}
                  <span className="text-label-lg tabular-nums text-on-surface">{formatUsd(totalEstimado)}</span>
                </>
              ) : (
                <>
                  Total estimado:{" "}
                  <span className="text-label-lg tabular-nums text-on-surface">{formatUsd(totalEstimado)}</span>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" disabled={guardando} onClick={() => setModalNueva(false)}>
                Cancelar
              </Button>
              <Button type="submit" form="form-factura" icon="save" loading={guardando} disabled={descuentoExcede}>
                Guardar factura
              </Button>
            </div>
          </div>
        }
      >
        <form id="form-factura" onSubmit={guardarFactura} className="flex flex-col gap-4" noValidate>
          <Select
            label="Cliente"
            name="cliente_id"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            options={clientesOpciones}
            placeholder="Seleccionar cliente…"
            error={errores.cliente_id}
            required
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Nº factura"
              name="numero_factura"
              placeholder="F-0001"
              value={numeroFactura}
              onChange={(e) => setNumeroFactura(e.target.value)}
              error={errores.numero_factura}
              autoCapitalize="characters"
              required
            />
            <Select
              label="Condición"
              name="condicion"
              value={condicion}
              onChange={(e) => setCondicion(e.target.value as "contado" | "credito")}
              options={[
                { value: "contado", label: "Contado" },
                { value: "credito", label: "Crédito" },
              ]}
              error={errores.condicion}
            />
            {condicion === "credito" ? (
              <Select
                label="Días de crédito"
                name="dias_credito"
                value={diasCredito}
                onChange={(e) => setDiasCredito(e.target.value)}
                options={DIAS_CREDITO_OPCIONES}
                error={errores.dias_credito}
              />
            ) : (
              <Input label="Días de crédito" value="0" readOnly className="text-on-surface-variant" />
            )}
          </div>

          <fieldset>
            <legend className="text-label-md text-on-surface-variant">Productos</legend>
            <div className="mt-2 flex flex-col gap-3">
              {items.map((item, idx) => {
                const producto = productos.find((p) => p.id === item.producto_id);
                return (
                  <div key={idx} className="grid grid-cols-[1fr_5.5rem_7.5rem_auto] items-end gap-2">
                    <Select
                      label={idx === 0 ? "Producto" : undefined}
                      name={`items.${idx}.producto_id`}
                      value={item.producto_id}
                      onChange={(e) => seleccionarProducto(idx, e.target.value)}
                      options={productosOpciones}
                      placeholder="Seleccionar…"
                      aria-label="Producto"
                    />
                    <Input
                      label={idx === 0 ? "Cant." : undefined}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      value={item.cantidad}
                      onChange={(e) => actualizarItem(idx, { cantidad: e.target.value.replace(/\D/g, "") })}
                      aria-label="Cantidad"
                    />
                    <Input
                      label={idx === 0 ? "Precio $" : undefined}
                      type="text"
                      inputMode="decimal"
                      readOnly
                      value={item.precio}
                      error={errores[`items.${idx}.precio_unitario_usd`]}
                      aria-label="Precio en USD (definido por el producto)"
                      className="text-on-surface-variant"
                    />
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Quitar producto"
                      disabled={items.length === 1}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error-container hover:text-error disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
                    >
                      <Icon name="delete" size={18} />
                    </button>
                    {producto && (
                      <p className="col-span-4 -mt-1 text-body-sm text-on-surface-variant">
                        Stock {producto.cantidad} u. ·{" "}
                        {(Number(item.cantidad) || 0) * (Number(item.precio) || 0) !== 0 && (
                          <span className="tabular-nums">{formatUsd((Number(item.cantidad) || 0) * (Number(item.precio) || 0))}</span>
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <Button type="button" variant="secondary" size="sm" icon="add" onClick={agregarItem} className="mt-3">
              Agregar producto
            </Button>
            {errores.items && <InlineAlert className="mt-2">{errores.items}</InlineAlert>}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Descuento ($)"
              name="descuento_usd"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={descuentoVista.monto}
              onChange={(e) => setDescuento((d) => ({ ...d, monto: e.target.value.replace(/[^0-9.,]/g, ""), fuente: "monto" }))}
              error={errores.descuento_usd}
              aria-label="Descuento en dólares"
            />
            <Input
              label="Descuento (%)"
              name="descuento_pct"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={descuentoVista.pct}
              onChange={(e) => setDescuento((d) => ({ ...d, pct: e.target.value.replace(/[^0-9.,]/g, ""), fuente: "pct" }))}
              aria-label="Descuento en porcentaje"
            />
          </div>
          {descuentoExcede && (
            <InlineAlert>El descuento no puede superar el subtotal de la factura.</InlineAlert>
          )}
        </form>
      </Modal>

      <FacturaDetalleModal
        factura={detalle}
        onClose={() => setDetalle(null)}
        accion={
          detalle && detalle.saldo_usd > 0 ? (
            <Button href={`/cobranza?pedido=${detalle.id}`} icon="payments" className="w-full">
              Registrar pago
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}