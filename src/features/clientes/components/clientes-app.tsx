"use client";

import { useRef, useState, useTransition } from "react";
import {
  crearCliente,
  actualizarCliente,
  eliminarCliente,
  listarClientes,
} from "@/features/clientes/actions";
import type { Cliente, ListarClientesResult } from "@/features/clientes/schemas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";

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

  function iniciales(nombre: string): string {
    return nombre
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
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
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-label-lg font-medium text-primary">
                  {iniciales(cliente.nombre_juridico)}
                </span>
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
    </div>
  );
}