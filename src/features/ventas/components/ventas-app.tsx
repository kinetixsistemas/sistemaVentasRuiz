"use client";

import { useRef, useState, useTransition } from "react";
import { crearFactura, listarFacturas, obtenerFactura } from "@/features/ventas/actions";
import type { Cliente } from "@/features/clientes/schemas";
import type { Producto } from "@/features/inventario/schemas";
import type { FacturaConSaldo, FacturaDetalle, ResumenCartera } from "@/features/ventas/schemas";
import { calcularTotal } from "@/features/ventas/schemas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { EstadoChip } from "@/components/ui/estado-chip";
import { Icon } from "@/components/ui/icon";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { Select, type SelectOption } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";
import { formatFecha, formatUsd, labelCondicion, labelMetodoPago } from "@/components/ui/format";

type ItemForm = { producto_id: string; cantidad: string; precio: string; stock: number };

const ITEM_VACIO: ItemForm = { producto_id: "", cantidad: "1", precio: "", stock: 0 };

const DIAS_CREDITO_OPCIONES: SelectOption[] = [
  { value: "7", label: "7 días" },
  { value: "15", label: "15 días" },
  { value: "30", label: "30 días" },
];

export function VentasApp({
  facturas,
  resumen,
  clientes,
  productos,
  abrirNueva = false,
  errorMensaje,
}: {
  facturas: FacturaConSaldo[];
  resumen?: ResumenCartera | null;
  clientes: Cliente[];
  productos: Producto[];
  /** Abre el modal de nueva venta al cargar (deep-link `/ventas?nueva=1`). */
  abrirNueva?: boolean;
  errorMensaje?: string;
}) {
  const toast = useToast();

  const [facturasLocales, setFacturasLocales] = useState<FacturaConSaldo[]>(facturas);
  const [busqueda, setBusqueda] = useState("");
  const [buscando, startBuscar] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [modalNueva, setModalNueva] = useState(abrirNueva);
  const [detalle, setDetalle] = useState<FacturaConSaldo | null>(null);
  const [detalleCargando, setDetalleCargando] = useState(false);
  const [detalleData, setDetalleData] = useState<FacturaDetalle | null>(null);

  const [clienteId, setClienteId] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [condicion, setCondicion] = useState<"contado" | "credito">("contado");
  const [diasCredito, setDiasCredito] = useState("7");
  const [items, setItems] = useState<ItemForm[]>([ITEM_VACIO]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, startGuardar] = useTransition();

  const clientesOpciones: SelectOption[] = clientes.map((c) => ({ value: c.id, label: c.nombre_juridico }));
  const productosOpciones: SelectOption[] = productos.map((p) => ({
    value: p.id,
    label: `${p.codigo} — ${p.nombre}`,
  }));

  // La búsqueda se resuelve en la BD (no se descarga el histórico completo).
  function cambiarBusqueda(valor: string) {
    setBusqueda(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startBuscar(async () => {
        const res = await listarFacturas({
          estado: "todas",
          limite: 50,
          busqueda: valor.trim() || undefined,
        });
        if (res.ok) setFacturasLocales(res.data);
        else toast.error(res.error.message);
      });
    }, 300);
  }

  const totalFacturasPendiente = facturasLocales.reduce((acc, f) => acc + f.saldo_usd, 0);
  const facturasAbiertas = resumen?.facturas_abiertas ?? facturasLocales.filter((f) => f.saldo_usd > 0).length;
  const porCobrar = resumen ? resumen.por_cobrar_usd : totalFacturasPendiente;

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

  function totalItems(): number {
    return calcularTotal(
      items.map((i) => ({
        cantidad: Number(i.cantidad) || 0,
        precio_unitario_usd: Number(i.precio) || 0,
      }))
    );
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
      toast.success("Factura creada y stock descontado");

      // La factura recién creada es la más reciente: se antepone a la lista
      // sin volver a consultar el listado completo.
      setFacturasLocales((prev) => [res.data.factura, ...prev].slice(0, 50));
    });
  }

  function abrirDetalle(factura: FacturaConSaldo) {
    setDetalle(factura);
    setDetalleData(null);
    setDetalleCargando(true);
    void obtenerFactura(factura.id).then((res) => {
      setDetalleCargando(false);
      if (res.ok) setDetalleData(res.data);
    });
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

      {buscando ? (
        <p className="py-6 text-center text-body-sm text-on-surface-variant">Buscando…</p>
      ) : facturasLocales.length === 0 ? (
        <EmptyState
          icon="receipt_long"
          title={busqueda ? "Sin resultados" : "Sin facturas"}
          description={busqueda ? `No hay facturas que coincidan con “${busqueda}”.` : "Registra tu primera venta para empezar a facturar."}
          action={!busqueda ? <Button onClick={() => setModalNueva(true)} icon="add">Nueva venta</Button> : <Button onClick={() => cambiarBusqueda("")} variant="secondary">Limpiar búsqueda</Button>}
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
                  <p className="truncate text-label-lg text-on-surface">
                    <span className="tabular-nums">{factura.numero_factura}</span>
                  </p>
                  <p className="truncate text-body-sm text-on-surface-variant">
                    {factura.nombre_juridico} · {formatFecha(factura.fecha_emision)} · {labelCondicion(factura.condicion)}
                    {factura.saldo_usd > 0 && (
                      <span className="tabular-nums"> · Saldo {formatUsd(factura.saldo_usd)}</span>
                    )}
                  </p>
                </div>
                <EstadoChip estado={factura.estado} className="hidden sm:inline-flex" />
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
              Total estimado:{" "}
              <span className="text-label-lg tabular-nums text-on-surface">{formatUsd(totalItems())}</span>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" disabled={guardando} onClick={() => setModalNueva(false)}>
                Cancelar
              </Button>
              <Button type="submit" form="form-factura" icon="save" loading={guardando}>
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
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={item.cantidad}
                      onChange={(e) => actualizarItem(idx, { cantidad: e.target.value })}
                      aria-label="Cantidad"
                    />
                    <Input
                      label={idx === 0 ? "Precio $" : undefined}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={item.precio}
                      onChange={(e) => actualizarItem(idx, { precio: e.target.value })}
                      aria-label="Precio en USD"
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
        </form>
      </Modal>

      <Modal
        open={detalle !== null}
        onClose={() => setDetalle(null)}
        title={detalle ? `Factura ${detalle.numero_factura}` : ""}
        size="md"
      >
        {detalle && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-on-surface">{detalle.nombre_juridico}</p>
                <p className="text-body-sm text-on-surface-variant tabular-nums">
                  {detalle.rif} · Emitida {formatFecha(detalle.fecha_emision)}
                </p>
                {detalle.fecha_vencimiento && (
                  <p className="text-body-sm text-on-surface-variant tabular-nums">
                    Vence {formatFecha(detalle.fecha_vencimiento)}
                  </p>
                )}
              </div>
              <EstadoChip estado={detalle.estado} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card contentClassName="flex flex-col gap-0.5 p-3">
                <p className="text-label-md text-on-surface-variant">Total</p>
                <p className="text-label-lg tabular-nums text-on-surface">{formatUsd(detalle.total_usd)}</p>
              </Card>
              <Card contentClassName="flex flex-col gap-0.5 p-3">
                <p className="text-label-md text-on-surface-variant">Saldo</p>
                <p className={cn("text-label-lg tabular-nums", detalle.saldo_usd > 0 ? "text-on-surface" : "text-status-pagada-text")}>
                  {formatUsd(detalle.saldo_usd)}
                </p>
              </Card>
            </div>

            {detalleCargando ? (
              <p className="py-6 text-center text-body-sm text-on-surface-variant">Cargando detalle…</p>
            ) : detalleData ? (
              <>
                <div>
                  <p className="mb-2 text-label-md text-on-surface-variant">Productos</p>
                  <Card contentClassName="p-0">
                    <ul className="divide-y divide-outline-variant">
                      {detalleData.items.map((item) => (
                        <li key={item.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                          <span className="min-w-0 truncate text-body-md text-on-surface">
                            {item.producto?.nombre ?? "—"}
                            <span className="text-body-sm text-on-surface-variant"> · {item.cantidad} u.</span>
                          </span>
                          <span className="shrink-0 text-label-md tabular-nums text-on-surface">{formatUsd(item.subtotal_usd)}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
                {detalleData.pagos.length > 0 && (
                  <div>
                    <p className="mb-2 text-label-md text-on-surface-variant">Pagos</p>
                    <Card contentClassName="p-0">
                      <ul className="divide-y divide-outline-variant">
                        {detalleData.pagos.map((pago) => (
                          <li key={pago.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                            <span className="min-w-0 truncate text-body-md text-on-surface">
                              {formatFecha(pago.fecha)} · {labelMetodoPago(pago.metodo)}
                            </span>
                            <span className="shrink-0 text-label-md tabular-nums text-on-surface">{formatUsd(pago.monto_usd)}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </div>
                )}
              </>
            ) : null}

            <a
              href={`/api/estado-cuenta/${detalle.cliente_id}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-surface-container text-label-lg text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Icon name="download" size={18} />
              Estado de cuenta del cliente
            </a>
          </div>
        )}
      </Modal>
    </div>
  );
}