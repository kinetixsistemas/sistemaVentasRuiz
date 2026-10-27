"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
  crearCliente,
  actualizarCliente,
  eliminarCliente,
  listarClientes,
} from "@/features/clientes/actions";
import { obtenerEstadoCuenta } from "@/features/cobranza/actions";
import type { EstadoCuenta, FacturaEstadoCuenta } from "@/features/cobranza/estado-cuenta";
import type { Cliente, ClienteConCartera, ListarClientesResult } from "@/features/clientes/schemas";
import type { Vendedor } from "@/features/vendedores/schemas";
import { FacturaDetalleModal } from "@/features/ventas/components/factura-detalle-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/components/ui/cn";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { EstadoChip } from "@/components/ui/estado-chip";
import { formatFecha, formatUsd } from "@/components/ui/format";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Select, type SelectOption } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { fechaHoyISO } from "@/lib/dates";
import { POR_PAGINA } from "@/lib/pagination";

const FORM_VACIO = {
  rif: "",
  nombre_juridico: "",
  nombre_encargado: "",
  telefono: "",
  correo: "",
  direccion: "",
  vendedor_id: "",
};

type ClienteForm = typeof FORM_VACIO;

type FiltroHistorial = "todas" | "pagadas" | "no_pagadas";

const FILTROS_HISTORIAL: { value: FiltroHistorial; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "pagadas", label: "Pagadas" },
  { value: "no_pagadas", label: "No pagadas" },
];

/** Una factura está cancelada cuando su saldo llega a cero (con tolerancia). */
function esPagada(factura: FacturaEstadoCuenta): boolean {
  return factura.saldo_usd <= 0.005;
}

/** Filtra las facturas del historial según el estado de pago elegido. */
function filtrarHistorial(
  facturas: FacturaEstadoCuenta[],
  filtro: FiltroHistorial
): FacturaEstadoCuenta[] {
  if (filtro === "pagadas") return facturas.filter(esPagada);
  if (filtro === "no_pagadas") return facturas.filter((f) => !esPagada(f));
  return facturas;
}

/** Inserta un cliente manteniendo el orden por nombre jurídico que usa la lista. */
function insertarOrdenado(lista: ClienteConCartera[], cliente: ClienteConCartera): ClienteConCartera[] {
  const copia = [...lista, cliente];
  copia.sort((a, b) => a.nombre_juridico.localeCompare(b.nombre_juridico, "es"));
  return copia;
}

export function ClientesApp({
  datos,
  vendedores,
  busquedaInicial = "",
  paginaInicial = 1,
  errorMensaje,
}: {
  datos: ListarClientesResult;
  vendedores: Vendedor[];
  /** Búsqueda leída de `?q=` para conservarla al recargar o compartir. */
  busquedaInicial?: string;
  /** Página leída de `?pagina=` para conservarla al recargar o compartir. */
  paginaInicial?: number;
  errorMensaje?: string;
}) {
  const toast = useToast();

  const [lista, setLista] = useState<ClienteConCartera[]>(datos.clientes);
  const [total, setTotal] = useState(datos.total);
  const [busqueda, setBusqueda] = useState(busquedaInicial);
  const [pagina, setPagina] = useState(paginaInicial);
  const [cargando, startCargar] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState<ClienteForm>(FORM_VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, startGuardar] = useTransition();

  const [eliminar, setEliminar] = useState<Cliente | null>(null);
  const [eliminando, startEliminar] = useTransition();

  const [historial, setHistorial] = useState<Cliente | null>(null);
  const [historialData, setHistorialData] = useState<EstadoCuenta | null>(null);
  const [historialCargando, setHistorialCargando] = useState(false);
  const [historialDesde, setHistorialDesde] = useState("");
  const [historialHasta, setHistorialHasta] = useState("");
  const [historialFiltro, setHistorialFiltro] = useState<FiltroHistorial>("todas");
  const [facturaDetalle, setFacturaDetalle] = useState<FacturaEstadoCuenta | null>(null);

  const vendedoresOpciones: SelectOption[] = vendedores
    .filter((v) => v.activo || v.id === form.vendedor_id)
    .map((v) => ({
      value: v.id,
      label: v.activo ? v.nombre : `${v.nombre} (inactivo)`,
    }));

  function nombreVendedor(id: string): string {
    return vendedores.find((v) => v.id === id)?.nombre ?? "";
  }

  const rangoValido =
    historialDesde !== "" && historialHasta !== "" && historialDesde <= historialHasta;

  const facturasHistorial = historialData?.facturas ?? [];
  const conteoPagadas = facturasHistorial.filter(esPagada).length;
  const conteosHistorial: Record<FiltroHistorial, number> = {
    todas: facturasHistorial.length,
    pagadas: conteoPagadas,
    no_pagadas: facturasHistorial.length - conteoPagadas,
  };
  const facturasVisibles = filtrarHistorial(facturasHistorial, historialFiltro);

  function cargarHistorial(clienteId: string, desde?: string, hasta?: string) {
    setHistorialCargando(true);
    void obtenerEstadoCuenta({ cliente_id: clienteId, desde, hasta }).then((res) => {
      setHistorialCargando(false);
      if (res.ok) setHistorialData(res.data);
      else toast.error(res.error.message);
    });
  }

  /** Abre el historial del cliente con el año en curso como rango por defecto. */
  function abrirHistorial(cliente: Cliente) {
    const hasta = fechaHoyISO();
    const desde = `${hasta.slice(0, 4)}-01-01`;
    setHistorial(cliente);
    setHistorialData(null);
    setHistorialDesde(desde);
    setHistorialHasta(hasta);
    setHistorialFiltro("todas");
    cargarHistorial(cliente.id, desde, hasta);
  }

  /** Refleja búsqueda y página en la URL para conservarlas al recargar. */
  function sincronizarUrl(q: string, paginaNueva: number) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q);
    if (paginaNueva > 1) params.set("pagina", String(paginaNueva));
    const query = params.toString();
    window.history.replaceState(null, "", `/clientes${query ? `?${query}` : ""}`);
  }

  async function recargar(busca?: string, paginaNueva?: number) {
    const q = busca ?? busqueda;
    const p = paginaNueva ?? pagina;
    const res = await listarClientes({ busqueda: q || undefined, pagina: p, porPagina: POR_PAGINA });
    if (res.ok) {
      setLista(res.data.clientes);
      setTotal(res.data.total);
      setPagina(p);
      sincronizarUrl(q, p);
    } else {
      toast.error(res.error.message);
    }
  }

  function cambiarBusqueda(valor: string) {
    setBusqueda(valor);
    sincronizarUrl(valor, 1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startCargar(async () => {
        await recargar(valor, 1);
      });
    }, 300);
  }

  function cambiarPagina(nueva: number) {
    if (nueva < 1) return;
    startCargar(async () => {
      await recargar(busqueda, nueva);
    });
  }

  function abrirNuevo() {
    setEditando(null);
    setForm(FORM_VACIO);
    setErrores({});
    setModalAbierto(true);
  }

  function abrirEditar(cliente: Cliente) {
    setEditando(cliente);
    setForm({
      rif: cliente.rif,
      nombre_juridico: cliente.nombre_juridico,
      nombre_encargado: cliente.nombre_encargado,
      telefono: cliente.telefono,
      correo: cliente.correo ?? "",
      direccion: cliente.direccion,
      vendedor_id: cliente.vendedor_id,
    });
    setErrores({});
    setModalAbierto(true);
  }

  function setCampo(campo: keyof ClienteForm, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrores({});
    startGuardar(async () => {
      const res = editando
        ? await actualizarCliente({ id: editando.id, ...form })
        : await crearCliente(form);

      if (!res.ok) {
        setErrores(res.error.fieldErrors ?? {});
        toast.error(res.error.message);
        return;
      }
      setModalAbierto(false);
      toast.success(editando ? "Cliente actualizado" : "Cliente creado");

      // Se actualiza la lista con la respuesta de la mutación. Solo se recarga
      // cuando hay una búsqueda activa (el filtro se resuelve en la base de datos).
      if (editando) {
        setLista((prev) =>
          prev.map((c) =>
            c.id === res.data.id ? { ...res.data, facturas_pendientes: c.facturas_pendientes } : c
          )
        );
      } else if (busqueda.trim() !== "") {
        await recargar();
      } else {
        setLista((prev) => insertarOrdenado(prev, { ...res.data, facturas_pendientes: 0 }));
        setTotal((t) => t + 1);
      }
    });
  }

  function confirmarEliminar() {
    if (!eliminar) return;
    startEliminar(async () => {
      const res = await eliminarCliente(eliminar.id);
      if (res.ok) {
        toast.success("Cliente eliminado");
        setLista((prev) => prev.filter((c) => c.id !== eliminar.id));
        setTotal((t) => Math.max(0, t - 1));
        setEliminar(null);
      } else {
        toast.error(res.error.message);
        setEliminar(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <SearchInput
          value={busqueda}
          onChange={(e) => cambiarBusqueda(e.target.value)}
          placeholder="Buscar por nombre, RIF o teléfono…"
          aria-label="Buscar cliente"
        />
        <Button onClick={abrirNuevo} icon="add" className="shrink-0" aria-label="Nuevo cliente">
          <span className="hidden sm:inline">Nuevo</span>
        </Button>
      </div>

      {errorMensaje && <Alert tone="error">{errorMensaje}</Alert>}

      {cargando ? (
        <ListSkeleton />
      ) : lista.length === 0 ? (
        <EmptyState
          icon="groups"
          title={busqueda ? "Sin resultados" : "Sin clientes"}
          description={busqueda ? `No hay clientes que coincidan con “${busqueda}”.` : "Agrega tu primer cliente para comenzar a facturar."}
          action={!busqueda ? <Button onClick={abrirNuevo} icon="add">Nuevo cliente</Button> : <Button onClick={() => cambiarBusqueda("")} variant="secondary">Limpiar búsqueda</Button>}
        />
      ) : (
        <Card contentClassName="p-0">
          <ul className="divide-y divide-outline-variant">
            {lista.map((cliente) => (
              <li key={cliente.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-label-lg text-on-surface">{cliente.nombre_juridico}</p>
                  <p className="truncate text-body-sm text-on-surface-variant tabular-nums">
                    {cliente.rif}
                    {nombreVendedor(cliente.vendedor_id) && (
                      <> · {nombreVendedor(cliente.vendedor_id)}</>
                    )}
                    {cliente.facturas_pendientes > 0 && (
                      <>
                        {" · "}
                        <span className="font-medium text-status-por-vencer-text">
                          {cliente.facturas_pendientes} por pagar
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => abrirHistorial(cliente)}
                  aria-label={`Historial de ${cliente.nombre_juridico}`}
                  title="Historial de facturas"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Icon name="receipt_long" size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => abrirEditar(cliente)}
                  aria-label={`Editar ${cliente.nombre_juridico}`}
                  title="Editar cliente"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Icon name="edit" size={18} />
                </button>
              </li>
            ))}
          </ul>
          <p className="border-t border-outline-variant px-5 py-2.5 text-body-sm text-on-surface-variant">
            {total} cliente{total === 1 ? "" : "s"}
          </p>
        </Card>
      )}

      {!cargando && lista.length > 0 && (
        <Pagination
          pagina={pagina}
          total={total}
          porPagina={POR_PAGINA}
          onCambiar={cambiarPagina}
          cargando={cargando}
        />
      )}

      <Modal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        title={editando ? "Editar cliente" : "Nuevo cliente"}
        size="md"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" className="w-full sm:flex-1" disabled={guardando} onClick={() => setModalAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-cliente" icon="save" loading={guardando} className="w-full sm:flex-1">
              Guardar
            </Button>
          </div>
        }
      >
        <form id="form-cliente" onSubmit={guardar} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="RIF"
              name="rif"
              placeholder="J-12345678-9"
              value={form.rif}
              onChange={(e) => setCampo("rif", e.target.value)}
              error={errores.rif}
              icon="badge"
              autoCapitalize="characters"
              autoComplete="off"
              required
            />
            <div className="flex flex-col gap-1.5">
              <Select
                label="Vendedor"
                name="vendedor_id"
                placeholder="Seleccionar vendedor…"
                options={vendedoresOpciones}
                value={form.vendedor_id}
                onChange={(e) => setCampo("vendedor_id", e.target.value)}
                error={errores.vendedor_id}
                required
              />
              {vendedores.length === 0 && (
                <Link
                  href="/vendedores"
                  className="text-body-sm text-primary hover:underline"
                >
                  Crear vendedor
                </Link>
              )}
            </div>
          </div>
          <Input
            label="Nombre jurídico (razón social)"
            name="nombre_juridico"
            value={form.nombre_juridico}
            onChange={(e) => setCampo("nombre_juridico", e.target.value)}
            error={errores.nombre_juridico}
            icon="building"
            required
          />
          <Input
            label="Nombre del encargado"
            name="nombre_encargado"
            value={form.nombre_encargado}
            onChange={(e) => setCampo("nombre_encargado", e.target.value)}
            error={errores.nombre_encargado}
            icon="person"
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Teléfono"
              name="telefono"
              type="tel"
              inputMode="tel"
              placeholder="04121234567"
              value={form.telefono}
              onChange={(e) => setCampo("telefono", e.target.value)}
              error={errores.telefono}
              icon="call"
              required
            />
            <Input
              label="Correo"
              name="correo"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              value={form.correo}
              onChange={(e) => setCampo("correo", e.target.value)}
              error={errores.correo}
              icon="mail"
            />
          </div>
          <Textarea
            label="Dirección"
            name="direccion"
            value={form.direccion}
            onChange={(e) => setCampo("direccion", e.target.value)}
            error={errores.direccion}
            rows={2}
            required
          />
          {editando && (
            <button
              type="button"
              onClick={() => setEliminar(editando)}
              className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-lg text-label-lg text-error transition-colors hover:bg-error-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
            >
              <Icon name="delete" size={18} />
              Eliminar clientecorreo
            </button>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="¿Eliminar cliente?"
        description={`“${eliminar?.nombre_juridico ?? ""}” se quitará de la cartera. No se elimina si tiene facturas.`}
        confirmLabel="Eliminar"
        danger
        loading={eliminando}
      />

      <Modal
        open={historial !== null}
        onClose={() => setHistorial(null)}
        title={`Historial · ${historial?.nombre_juridico ?? ""}`}
        size="md"
        footer={
          historial ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={urlPdfHistorial(historial.id, historialData?.rango ?? null)}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-label-lg text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Icon name="download" size={18} />
                PDF del período
              </a>
              <a
                href={`/api/estado-cuenta/${historial.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-surface-container text-label-lg text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Icon name="download" size={18} />
                PDF completo
              </a>
            </div>
          ) : undefined
        }
      >
        {historial && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Input
                label="Desde"
                name="historial_desde"
                type="date"
                value={historialDesde}
                max={historialHasta || undefined}
                onChange={(e) => setHistorialDesde(e.target.value)}
              />
              <Input
                label="Hasta"
                name="historial_hasta"
                type="date"
                value={historialHasta}
                min={historialDesde || undefined}
                onChange={(e) => setHistorialHasta(e.target.value)}
              />
              <Button
                variant="secondary"
                icon="filter"
                disabled={!rangoValido || historialCargando}
                onClick={() => cargarHistorial(historial.id, historialDesde, historialHasta)}
              >
                Aplicar
              </Button>
            </div>

            {historialCargando ? (
              <p className="py-6 text-center text-body-sm text-on-surface-variant">Cargando historial…</p>
            ) : historialData ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Card contentClassName="flex flex-col gap-0.5 p-3">
                    <p className="text-label-md text-on-surface-variant">
                      Facturado ({facturasHistorial.length})
                    </p>
                    <p className="text-label-lg tabular-nums text-on-surface">
                      {formatUsd(historialData.facturas.reduce((acc, f) => acc + f.total_usd, 0))}
                    </p>
                  </Card>
                  <Card contentClassName="flex flex-col gap-0.5 p-3">
                    <p className="text-label-md text-on-surface-variant">Saldo pendiente</p>
                    <p className="text-label-lg tabular-nums text-on-surface">
                      {formatUsd(historialData.saldo_pendiente_total)}
                    </p>
                  </Card>
                </div>

                {facturasHistorial.length > 0 && (
                  <div
                    role="group"
                    aria-label="Filtrar por estado de pago"
                    className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5"
                  >
                    {FILTROS_HISTORIAL.map((filtro) => (
                      <button
                        key={filtro.value}
                        type="button"
                        onClick={() => setHistorialFiltro(filtro.value)}
                        aria-pressed={historialFiltro === filtro.value}
                        className={cn(
                          "h-9 shrink-0 rounded-full px-3.5 text-label-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          historialFiltro === filtro.value
                            ? "bg-primary text-on-primary"
                            : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                        )}
                      >
                        {filtro.label} ({conteosHistorial[filtro.value]})
                      </button>
                    ))}
                  </div>
                )}

                {facturasHistorial.length === 0 ? (
                  <p className="py-6 text-center text-body-sm text-on-surface-variant">
                    Sin facturas emitidas en el período seleccionado.
                  </p>
                ) : facturasVisibles.length === 0 ? (
                  <p className="py-6 text-center text-body-sm text-on-surface-variant">
                    {historialFiltro === "pagadas"
                      ? "Sin facturas pagadas en el período seleccionado."
                      : "Sin facturas con saldo pendiente en el período seleccionado."}
                  </p>
                ) : (
                  <Card contentClassName="p-0">
                    <ul className="divide-y divide-outline-variant">
                      {facturasVisibles.map((factura) => (
                        <li key={factura.factura_id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-label-md tabular-nums text-on-surface">
                              {factura.numero_factura}
                            </p>
                            <p className="truncate text-body-sm tabular-nums text-on-surface-variant">
                              {formatFecha(factura.fecha_emision)} · Vence {formatFecha(factura.fecha_vencimiento)}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                            <EstadoChip estado={factura.estado} />
                            <p className="text-label-md tabular-nums text-on-surface">
                              {formatUsd(factura.total_usd)}
                            </p>
                            {!esPagada(factura) && (
                              <p className="text-body-sm tabular-nums text-on-surface-variant">
                                Saldo {formatUsd(factura.saldo_usd)}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setFacturaDetalle(factura)}
                            aria-label={`Ver factura ${factura.numero_factura}`}
                            title="Ver factura completa"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          >
                            <Icon name="chevron_right" size={20} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </>
            ) : null}
          </div>
        )}
      </Modal>

      <FacturaDetalleModal
        factura={
          facturaDetalle
            ? {
                id: facturaDetalle.factura_id,
                numero_factura: facturaDetalle.numero_factura,
                estado: facturaDetalle.estado,
                total_usd: facturaDetalle.total_usd,
                total_pagado_usd: facturaDetalle.pagado_usd,
                saldo_usd: facturaDetalle.saldo_usd,
              }
            : null
        }
        onClose={() => setFacturaDetalle(null)}
        accion={
          facturaDetalle && facturaDetalle.saldo_usd > 0 ? (
            <Button
              href={`/cobranza?pedido=${facturaDetalle.factura_id}`}
              icon="payments"
              className="w-full"
            >
              Registrar pago
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

/** URL del PDF del estado de cuenta, con rango de emisión cuando aplique. */
function urlPdfHistorial(clienteId: string, rango: { desde: string; hasta: string } | null): string {
  const base = `/api/estado-cuenta/${clienteId}`;
  return rango ? `${base}?desde=${rango.desde}&hasta=${rango.hasta}` : base;
}