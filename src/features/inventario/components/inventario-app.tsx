"use client";

import { useRef, useState, useTransition } from "react";
import { crearProducto, actualizarProducto, eliminarProducto, listarProductos, subirFotoProducto } from "@/features/inventario/actions";
import type { Producto, ListarProductosResult } from "@/features/inventario/schemas";
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
import { cn } from "@/components/ui/cn";
import { formatUsd } from "@/components/ui/format";
import { comprimirImagen } from "@/lib/image";

const FORM_VACIO = { codigo: "", nombre: "", cantidad: "", precio_usd: "" };

type ProductoForm = typeof FORM_VACIO;

/** Inserta un producto manteniendo el orden por código que usa la lista. */
function insertarOrdenado(lista: Producto[], producto: Producto): Producto[] {
  const copia = [...lista, producto];
  copia.sort((a, b) => a.codigo.localeCompare(b.codigo, "es"));
  return copia;
}

export function InventarioApp({
  datos,
  busquedaInicial = "",
  errorMensaje,
  umbralStock,
}: {
  datos: ListarProductosResult;
  /** Búsqueda leída de `?q=` para conservarla al recargar o compartir. */
  busquedaInicial?: string;
  errorMensaje?: string;
  umbralStock: number;
}) {
  const toast = useToast();

  const [lista, setLista] = useState<Producto[]>(datos.productos);
  const [total, setTotal] = useState(datos.total);
  const [busqueda, setBusqueda] = useState(busquedaInicial);
  const [cargando, startCargar] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [form, setForm] = useState<ProductoForm>(FORM_VACIO);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoNueva, setFotoNueva] = useState<File | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, startGuardar] = useTransition();

  const [eliminar, setEliminar] = useState<Producto | null>(null);
  const [eliminando, startEliminar] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function recargar(busca?: string) {
    const res = await listarProductos({ busqueda: busca ?? busqueda, porPagina: 100 });
    if (res.ok) {
      setLista(res.data.productos);
      setTotal(res.data.total);
    } else {
      toast.error(res.error.message);
    }
  }

  function cambiarBusqueda(valor: string) {
    setBusqueda(valor);
    const query = valor.trim() ? `?q=${encodeURIComponent(valor)}` : "";
    window.history.replaceState(null, "", `/inventario${query}`);
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
    setFotoUrl(null);
    setFotoNueva(null);
    setErrores({});
    setModalAbierto(true);
  }

  function abrirEditar(producto: Producto) {
    setEditando(producto);
    setForm({
      codigo: producto.codigo,
      nombre: producto.nombre,
      cantidad: String(producto.cantidad),
      precio_usd: String(producto.precio_usd),
    });
    setFotoUrl(producto.foto_url);
    setFotoNueva(null);
    setErrores({});
    setModalAbierto(true);
  }

  function cambiarFoto(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (archivo) setFotoNueva(archivo);
  }

  function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrores({});
    startGuardar(async () => {
      const base = {
        codigo: form.codigo,
        nombre: form.nombre,
        cantidad: form.cantidad === "" ? undefined : Number(form.cantidad),
        precio_usd: form.precio_usd === "" ? undefined : Number(form.precio_usd),
      };
      const res = editando
        ? await actualizarProducto({ id: editando.id, ...base })
        : await crearProducto(base);

      if (!res.ok) {
        setErrores(res.error.fieldErrors ?? {});
        toast.error(res.error.message);
        return;
      }

      let nuevoFotoUrl = editando?.foto_url ?? null;
      if (fotoNueva) {
        const optimizado = await comprimirImagen(fotoNueva, { maxLado: 800, calidad: 0.8, nombre: "foto.webp" });
        const datos = new FormData();
        datos.append("producto_id", res.data.id);
        datos.append("foto", optimizado);
        const fotoRes = await subirFotoProducto(datos);
        if (fotoRes.ok) nuevoFotoUrl = fotoRes.data.foto_url;
      }

      setModalAbierto(false);
      toast.success(editando ? "Producto actualizado" : "Producto creado");

      // Se actualiza la lista con la respuesta de la mutación (incluida la foto
      // recién subida). Solo se recarga con una búsqueda activa.
      const producto: Producto = { ...res.data, foto_url: nuevoFotoUrl };
      if (editando) {
        setLista((prev) => prev.map((p) => (p.id === producto.id ? producto : p)));
      } else if (busqueda.trim() !== "") {
        await recargar();
      } else {
        setLista((prev) => insertarOrdenado(prev, producto));
        setTotal((t) => t + 1);
      }
    });
  }

  function confirmarEliminar() {
    if (!eliminar) return;
    startEliminar(async () => {
      const res = await eliminarProducto(eliminar.id);
      if (res.ok) {
        toast.success("Producto eliminado");
        setLista((prev) => prev.filter((p) => p.id !== eliminar.id));
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
          placeholder="Buscar por código o nombre…"
          aria-label="Buscar producto"
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
          icon="inventory_2"
          title={busqueda ? "Sin resultados" : "Sin productos"}
          description={busqueda ? `No hay productos que coincidan con “${busqueda}”.` : "Agrega tu primer producto para empezar."}
          action={!busqueda ? <Button onClick={abrirNuevo} icon="add">Nuevo producto</Button> : <Button onClick={() => cambiarBusqueda("")} variant="secondary">Limpiar búsqueda</Button>}
        />
      ) : (
        <Card contentClassName="p-0">
          <ul className="divide-y divide-outline-variant">
            {lista.map((producto) => {
              const bajo = producto.cantidad <= umbralStock;
              return (
                <li key={producto.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  {producto.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={producto.foto_url}
                      alt=""
                      width={44}
                      height={44}
                      className="h-11 w-11 shrink-0 rounded-lg bg-surface-container object-cover"
                    />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
                      <Icon name="inventory_2" size={20} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-label-lg text-on-surface">{producto.nombre}</p>
                    <p className="text-body-sm text-on-surface-variant">
                      <span className="tabular-nums">{producto.codigo}</span> · {formatUsd(producto.precio_usd)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-label-md tabular-nums",
                      producto.cantidad === 0
                        ? "bg-status-vencida-bg text-status-vencida-text"
                        : bajo
                          ? "bg-status-por-vencer-bg text-status-por-vencer-text"
                          : "bg-status-pagada-bg text-status-pagada-text"
                    )}
                  >
                    {producto.cantidad} u.
                  </span>
                  <button
                    type="button"
                    onClick={() => abrirEditar(producto)}
                    aria-label={`Editar ${producto.nombre}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <Icon name="edit" size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-outline-variant px-5 py-2.5 text-body-sm text-on-surface-variant">
            {total} producto{total === 1 ? "" : "s"}
          </p>
        </Card>
      )}

      <Modal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        title={editando ? "Editar producto" : "Nuevo producto"}
        size="sm"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" className="w-full sm:flex-1" disabled={guardando} onClick={() => setModalAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-producto" icon="save" loading={guardando} className="w-full sm:flex-1">
              Guardar
            </Button>
          </div>
        }
      >
        <form id="form-producto" onSubmit={guardar} className="flex flex-col gap-4" noValidate>
          <div className="flex items-center gap-3">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container">
              {fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoUrl} alt="" width={64} height={64} className="h-full w-full object-cover" />
              ) : (
                <Icon name="inventory_2" size={28} className="text-on-surface-variant" />
              )}
            </span>
            <div className="flex flex-col gap-2">
              <input ref={fileInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={cambiarFoto} />
              <Button variant="secondary" size="sm" icon={fotoNueva ? "image_plus" : "camera"} onClick={() => fileInput.current?.click()}>
                {fotoNueva ? "Cambiar" : "Tomar / subir foto"}
              </Button>
              {fotoNueva && <p className="text-label-sm text-on-surface-variant">Nueva foto lista para guardar.</p>}
            </div>
          </div>

          <Input
            label="Código"
            name="codigo"
            placeholder="ABC-123"
            value={form.codigo}
            onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
            error={errores.codigo}
            icon="badge"
            autoCapitalize="characters"
            required
          />
          <Input
            label="Nombre"
            name="nombre"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            error={errores.nombre}
            icon="inventory_2"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Cantidad"
              name="cantidad"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={form.cantidad}
              onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
              error={errores.cantidad}
              required
            />
            <Input
              label="Precio (USD)"
              name="precio_usd"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.precio_usd}
              onChange={(e) => setForm((f) => ({ ...f, precio_usd: e.target.value }))}
              error={errores.precio_usd}
              required
            />
          </div>
          {editando && (
            <button
              type="button"
              onClick={() => setEliminar(editando)}
              className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-lg text-label-lg text-error transition-colors hover:bg-error-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
            >
              <Icon name="delete" size={18} />
              Eliminar producto
            </button>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="¿Eliminar producto?"
        description={`“${eliminar?.nombre ?? ""}” se quitará del inventario. No se elimina si ya tiene facturas.`}
        confirmLabel="Eliminar"
        danger
        loading={eliminando}
      />
    </div>
  );
}