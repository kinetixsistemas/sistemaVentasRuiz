"use client";

import { useRef, useState, useTransition } from "react";
import {
  crearCliente,
  actualizarCliente,
  eliminarCliente,
  listarClientes,
} from "@/features/clientes/actions";
import { obtenerEstadoCuenta } from "@/features/cobranza/actions";
import type { EstadoCuenta, FacturaEstadoCuenta } from "@/features/cobranza/estado-cuenta";
import type { Cliente, ListarClientesResult } from "@/features/clientes/schemas";
import { FacturaDetalleModal } from "@/features/ventas/components/factura-detalle-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { EstadoChip } from "@/components/ui/estado-chip";
import { formatFecha, formatUsd } from "@/components/ui/format";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { fechaHoyISO } from "@/lib/dates";

const FORM_VACIO = {
  rif: "",
  nombre_juridico: "",
  nombre_encargado: "",
  telefono: "",
  correo: "",
  direccion: "",
  vendedor: "",
};

type ClienteForm = typeof FORM_VACIO;

/** Inserta un cliente manteniendo el orden por nombre jurídico que usa la lista. */
function insertarOrdenado(lista: Cliente[], cliente: Cliente): Cliente[] {
  const copia = [...lista, cliente];
  copia.sort((a, b) => a.nombre_juridico.localeCompare(b.nombre_juridico, "es"));
  return copia;
}

export function ClientesApp({
  datos,
  busquedaInicial = "",
  errorMensaje,
}: {
  datos: ListarClientesResult;
  /** Búsqueda leída de `?q=` para conservarla al recargar o compartir. */
  busquedaInicial?: string;
  errorMensaje?: string;
}) {
  const toast = useToast();

  const [lista, setLista] = useState<Cliente[]>(datos.clientes);
  const [total, setTotal] = useState(datos.total);
  const [busqueda, setBusqueda] = useState(busquedaInicial);
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
  const [facturaDetalle, setFacturaDetalle] = useState<FacturaEstadoCuenta | null>(null);

  const rangoValido =
    historialDesde !== "" && historialHasta !== "" && historialDesde <= historialHasta;

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
    cargarHistorial(cliente.id, desde, hasta);
  }

  async function recargar(busca?: string) {
    const res = await listarClientes({ busqueda: busca ?? busqueda, porPagina: 100 });
    if (res.ok) {
      setLista(res.data.clientes);
      setTotal(res.data.total);
    } else {
      toast.error(res.error.message);
    }
  }

  function cambiarBusqueda(valor: string) {
    setBusqueda(valor);
    const query = valor.trim() ? `?q=${encodeURIComponent(valor)}` : "";
    window.history.replaceState(null, "", `/clientes${query}`);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startCargar(async () => {
        await recargar(valor);
      });
    }, 300);
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
      correo: cliente.correo,
      direccion: cliente.direccion,
      vendedor: cliente.vendedor,
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
        setLista((prev) => prev.map((c) => (c.id === res.data.id ? res.data : c)));
      } else if (busqueda.trim() !== "") {
        await recargar();
      } else {
        setLista((prev) => insertarOrdenado(prev, res.data));
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
        <Button onClick={abrirNuevo} icon="add" className="shrink-0">
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
                    {cliente.rif} · {cliente.telefono}
                  </p>
                </div>
                <a
                  href={`/api/estado-cuenta/${cliente.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label={`Descargar estado de cuenta de ${cliente.nombre_juridico}`}
                  title="Estado de cuenta (PDF)"
                >
                  <Icon name="download" size={18} />
                </a>
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
            <Input
              label="Vendedor"
              name="vendedor"
              placeholder="Nombre del vendedor"
              value={form.vendedor}
              onChange={(e) => setCampo("vendedor", e.target.value)}
              error={errores.vendedor}
              icon="person"
              required
            />
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
              required
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
              Eliminar cliente
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
                      Facturado ({historialData.facturas.length})
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

                {historialData.facturas.length === 0 ? (
                  <p className="py-6 text-center text-body-sm text-on-surface-variant">
                    Sin facturas emitidas en el período seleccionado.
                  </p>
                ) : (
                  <Card contentClassName="p-0">
                    <ul className="divide-y divide-outline-variant">
                      {historialData.facturas.map((factura) => (
                        <li key={factura.factura_id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-label-md tabular-nums text-on-surface">
                              {factura.numero_factura}
                            </p>
                            <p className="truncate text-body-sm tabular-nums text-on-surface-variant">
                              {formatFecha(factura.fecha_emision)} · Vence {formatFecha(factura.fecha_vencimiento)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-label-md tabular-nums text-on-surface">
                              {formatUsd(factura.total_usd)}
                            </p>
                            {factura.saldo_usd > 0 && (
                              <p className="text-body-sm tabular-nums text-on-surface-variant">
                                Saldo {formatUsd(factura.saldo_usd)}
                              </p>
                            )}
                          </div>
                          <EstadoChip estado={factura.estado} className="shrink-0" />
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