"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  actualizarProducto,
  crearCategoria,
  crearProducto,
  eliminarProducto,
  listarProductos,
  listarSugerenciasProductos,
  subirFotoProducto,
} from "@/features/inventario/actions";
import type {
  Categoria,
  CategoriaFiltro,
  ExistenciaFiltro,
  ListarProductosResult,
  Producto,
  SugerenciaProducto,
} from "@/features/inventario/schemas";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";
import { formatUsd } from "@/components/ui/format";
import { comprimirImagen } from "@/lib/image";
import { POR_PAGINA } from "@/lib/pagination";

const FORM_VACIO = { codigo: "", nombre: "", cantidad: "", precio_usd: "", categoria_id: "" };

type ProductoForm = typeof FORM_VACIO;

const FILTROS: { value: ExistenciaFiltro; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "con", label: "Con existencia" },
  { value: "sin", label: "Sin existencia" },
];

/** Inserta un producto manteniendo el orden por código que usa la lista. */
function insertarOrdenado(lista: Producto[], producto: Producto): Producto[] {
  const copia = [...lista, producto];
  copia.sort((a, b) => a.codigo.localeCompare(b.codigo, "es"));
  return copia;
}

function urlInventario(
  busqueda: string,
  existencia: ExistenciaFiltro,
  categoria: CategoriaFiltro,
  pagina = 1
): string {
  const params = new URLSearchParams();
  if (busqueda.trim()) params.set("q", busqueda.trim());
  if (existencia !== "todo") params.set("existencia", existencia);
  if (categoria) params.set("categoria", categoria);
  if (pagina > 1) params.set("pagina", String(pagina));
  const query = params.toString();
  return `/inventario${query ? `?${query}` : ""}`;
}

/** Resalta las coincidencias del término de búsqueda dentro de un texto. */
function resaltar(texto: string, termino: string) {
  const limpio = termino.trim();
  if (!limpio) return texto;
  const indice = texto.toLowerCase().indexOf(limpio.toLowerCase());
  if (indice === -1) return texto;
  return (
    <>
      {texto.slice(0, indice)}
      <mark className="rounded-sm bg-primary/15 px-0.5 text-primary">
        {texto.slice(indice, indice + limpio.length)}
      </mark>
      {texto.slice(indice + limpio.length)}
    </>
  );
}

export function InventarioApp({
  datos,
  categorias: categoriasIniciales,
  busquedaInicial = "",
  existenciaInicial = "todo",
  categoriaInicial = null,
  paginaInicial = 1,
  errorMensaje,
  umbralStock,
}: {
  datos: ListarProductosResult;
  categorias: Categoria[];
  /** Búsqueda leída de `?q=` para conservarla al recargar o compartir. */
  busquedaInicial?: string;
  existenciaInicial?: ExistenciaFiltro;
  /** Categoría leída de `?categoria=`: `null` = todas. */
  categoriaInicial?: CategoriaFiltro;
  /** Página leída de `?pagina=` para conservarla al recargar o compartir. */
  paginaInicial?: number;
  errorMensaje?: string;
  umbralStock: number;
}) {
  const toast = useToast();

  const [lista, setLista] = useState<Producto[]>(datos.productos);
  const [total, setTotal] = useState(datos.total);
  const [busqueda, setBusqueda] = useState(busquedaInicial);
  const [existencia, setExistencia] = useState<ExistenciaFiltro>(existenciaInicial);
  const [categoria, setCategoria] = useState<CategoriaFiltro>(categoriaInicial);
  const [pagina, setPagina] = useState(paginaInicial);
  const [categorias, setCategorias] = useState<Categoria[]>(categoriasIniciales);
  const [cargando, startCargar] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sugerencias, setSugerencias] = useState<SugerenciaProducto[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  const categoriasPorId = useMemo(
    () => new Map(categorias.map((categoria) => [categoria.id, categoria.nombre])),
    [categorias]
  );

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [form, setForm] = useState<ProductoForm>(FORM_VACIO);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoNueva, setFotoNueva] = useState<File | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, startGuardar] = useTransition();

  const [agregandoCategoria, setAgregandoCategoria] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [errorCategoria, setErrorCategoria] = useState<string | undefined>();
  const [creandoCategoria, startCrearCategoria] = useTransition();

  const [eliminar, setEliminar] = useState<Producto | null>(null);
  const [eliminando, startEliminar] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function recargar(
    busca?: string,
    filtro?: ExistenciaFiltro,
    categoriaNueva?: CategoriaFiltro,
    paginaNueva?: number
  ) {
    const q = busca ?? busqueda;
    const f = filtro ?? existencia;
    const c = categoriaNueva !== undefined ? categoriaNueva : categoria;
    const p = paginaNueva ?? pagina;
    const res = await listarProductos({
      busqueda: q || undefined,
      existencia: f,
      categoria: c,
      pagina: p,
      porPagina: POR_PAGINA,
    });
    if (res.ok) {
      setLista(res.data.productos);
      setTotal(res.data.total);
      setPagina(p);
      window.history.replaceState(null, "", urlInventario(q, f, c, p));
    } else {
      toast.error(res.error.message);
    }
  }

  async function buscarSugerencias(valor: string) {
    if (!valor.trim()) {
      setSugerencias([]);
      return;
    }
    const res = await listarSugerenciasProductos({ busqueda: valor, limite: 6 });
    if (res.ok) setSugerencias(res.data);
  }

  function cambiarBusqueda(valor: string) {
    setBusqueda(valor);
    setMostrarSugerencias(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startCargar(async () => {
        await Promise.all([recargar(valor, existencia, categoria, 1), buscarSugerencias(valor)]);
      });
    }, 300);
  }

  function seleccionarSugerencia(sugerencia: SugerenciaProducto) {
    setMostrarSugerencias(false);
    setSugerencias([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setBusqueda(sugerencia.codigo);
    startCargar(async () => {
      await recargar(sugerencia.codigo, existencia, categoria, 1);
    });
  }

  function cambiarExistencia(filtro: ExistenciaFiltro) {
    if (filtro === existencia) return;
    setExistencia(filtro);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    startCargar(async () => {
      await recargar(busqueda, filtro, categoria, 1);
    });
  }

  function cambiarCategoria(filtro: CategoriaFiltro) {
    if (filtro === categoria) return;
    setCategoria(filtro);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    startCargar(async () => {
      await recargar(busqueda, existencia, filtro, 1);
    });
  }

  function cambiarPagina(nueva: number) {
    if (nueva < 1 || nueva === pagina) return;
    setMostrarSugerencias(false);
    startCargar(async () => {
      await recargar(busqueda, existencia, categoria, nueva);
    });
  }

  function exportarPdf() {
    const params = new URLSearchParams();
    if (busqueda.trim()) params.set("q", busqueda.trim());
    if (existencia !== "todo") params.set("existencia", existencia);
    if (categoria) params.set("categoria", categoria);
    const query = params.toString();
    window.open(`/api/inventario/pdf${query ? `?${query}` : ""}`, "_blank", "noopener");
  }

  function abrirNuevo() {
    setEditando(null);
    setForm(FORM_VACIO);
    setFotoUrl(null);
    setFotoNueva(null);
    setErrores({});
    setAgregandoCategoria(false);
    setNuevaCategoria("");
    setErrorCategoria(undefined);
    setModalAbierto(true);
  }

  function abrirEditar(producto: Producto) {
    setEditando(producto);
    setForm({
      codigo: producto.codigo,
      nombre: producto.nombre,
      cantidad: String(producto.cantidad),
      precio_usd: String(producto.precio_usd),
      categoria_id: producto.categoria_id ?? "",
    });
    setFotoUrl(producto.foto_url);
    setFotoNueva(null);
    setErrores({});
    setAgregandoCategoria(false);
    setNuevaCategoria("");
    setErrorCategoria(undefined);
    setModalAbierto(true);
  }

  function cambiarFoto(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (archivo) setFotoNueva(archivo);
  }

  function guardarCategoriaRapida() {
    const nombre = nuevaCategoria.trim();
    if (!nombre) {
      setErrorCategoria("Escribe el nombre de la categoría");
      return;
    }

    startCrearCategoria(async () => {
      const res = await crearCategoria({ nombre });
      if (!res.ok) {
        setErrorCategoria(res.error.fieldErrors?.nombre ?? res.error.message);
        return;
      }

      setCategorias((prev) => {
        if (prev.some((categoria) => categoria.id === res.data.id)) return prev;
        return [...prev, res.data].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      });
      setForm((actual) => ({ ...actual, categoria_id: res.data.id }));
      setNuevaCategoria("");
      setErrorCategoria(undefined);
      setAgregandoCategoria(false);
      toast.success("Categoría creada");
    });
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
        categoria_id: form.categoria_id || null,
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
      // recién subida). Solo se recarga con una búsqueda o filtro activo.
      const producto: Producto = { ...res.data, foto_url: nuevoFotoUrl };
      if (busqueda.trim() !== "" || existencia !== "todo" || categoria || pagina > 1) {
        await recargar(busqueda, existencia, categoria, pagina);
      } else if (editando) {
        setLista((prev) => prev.map((p) => (p.id === producto.id ? producto : p)));
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
        setTotal((t) => Math.max(0, t - 1));
        setEliminar(null);
      } else {
        toast.error(res.error.message);
        setEliminar(null);
      }
    });
  }

  function limpiarFiltros() {
    setBusqueda("");
    setExistencia("todo");
    setCategoria(null);
    setMostrarSugerencias(false);
    setSugerencias([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    startCargar(async () => {
      await recargar("", "todo", null, 1);
    });
  }

  const sinResultados = busqueda.trim() !== "" || existencia !== "todo" || categoria !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <SearchInput
              value={busqueda}
              onChange={(e) => cambiarBusqueda(e.target.value)}
              onFocus={() => setMostrarSugerencias(true)}
              onBlur={() => window.setTimeout(() => setMostrarSugerencias(false), 120)}
              placeholder="Buscar por código o nombre…"
              aria-label="Buscar producto"
              autoComplete="off"
              role="combobox"
              aria-expanded={mostrarSugerencias && sugerencias.length > 0}
              aria-controls="sugerencias-productos"
            />

            {mostrarSugerencias && busqueda.trim() !== "" && sugerencias.length > 0 && (
              <ul
                id="sugerencias-productos"
                role="listbox"
                className="absolute inset-x-0 top-[calc(100%+0.375rem)] z-30 overflow-hidden rounded-xl bg-surface-container-lowest py-1 shadow-overlay animate-slide-down"
              >
                <li className="px-3 py-1.5 text-label-sm text-on-surface-variant" role="presentation">
                  Productos parecidos
                </li>
                {sugerencias.map((sugerencia) => (
                  <li key={sugerencia.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => seleccionarSugerencia(sugerencia)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:bg-surface-container"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
                        <Icon name="inventory_2" size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-label-md text-on-surface">
                          {resaltar(sugerencia.nombre, busqueda)}
                        </span>
                        <span className="block truncate text-body-sm tabular-nums text-on-surface-variant">
                          {resaltar(sugerencia.codigo, busqueda)} · {sugerencia.cantidad} u.
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button onClick={abrirNuevo} icon="add" className="shrink-0" aria-label="Nuevo producto">
            <span className="hidden sm:inline">Nuevo</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Filtrar por existencia"
            className="flex min-w-0 flex-1 overflow-x-auto rounded-full bg-surface-container p-1"
          >
            {FILTROS.map((filtro) => (
              <button
                key={filtro.value}
                type="button"
                onClick={() => cambiarExistencia(filtro.value)}
                aria-pressed={existencia === filtro.value}
                className={cn(
                  "h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-label-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  existencia === filtro.value
                    ? "bg-surface-container-lowest text-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                )}
              >
                {filtro.label}
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            icon="download"
            onClick={exportarPdf}
            className="shrink-0"
          >
            <span className="hidden sm:inline">Exportar PDF</span>
          </Button>
        </div>

        <div
          role="group"
          aria-label="Filtrar por categoría"
          className="flex items-center gap-2 overflow-x-auto pb-0.5"
        >
          <span className="shrink-0 text-label-sm uppercase tracking-wider text-on-surface-variant">
            Categoría
          </span>
          <button
            type="button"
            onClick={() => cambiarCategoria(null)}
            aria-pressed={categoria === null}
            className={cn(
              "h-8 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-label-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              categoria === null
                ? "border-primary bg-primary/10 text-primary"
                : "border-outline-variant text-on-surface-variant hover:border-on-surface-variant hover:text-on-surface"
            )}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => cambiarCategoria("sin")}
            aria-pressed={categoria === "sin"}
            className={cn(
              "h-8 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-label-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              categoria === "sin"
                ? "border-primary bg-primary/10 text-primary"
                : "border-outline-variant text-on-surface-variant hover:border-on-surface-variant hover:text-on-surface"
            )}
          >
            Sin categoría
          </button>
          {categorias.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => cambiarCategoria(cat.id)}
              aria-pressed={categoria === cat.id}
              className={cn(
                "h-8 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-label-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                categoria === cat.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-outline-variant text-on-surface-variant hover:border-on-surface-variant hover:text-on-surface"
              )}
            >
              {cat.nombre}
            </button>
          ))}
        </div>
      </div>

      {errorMensaje && <Alert tone="error">{errorMensaje}</Alert>}

      {cargando ? (
        <CardGridSkeleton />
      ) : lista.length === 0 ? (
        <EmptyState
          icon="inventory_2"
          title={sinResultados ? "Sin resultados" : "Sin productos"}
          description={
            sinResultados
              ? "No hay productos que coincidan con la búsqueda o el filtro seleccionado."
              : "Agrega tu primer producto para empezar."
          }
          action={
            sinResultados ? (
              <Button onClick={limpiarFiltros} variant="secondary">
                Limpiar filtros
              </Button>
            ) : (
              <Button onClick={abrirNuevo} icon="add">Nuevo producto</Button>
            )
          }
        />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {lista.map((producto) => {
              const agotado = producto.cantidad === 0;
              const bajo = producto.cantidad <= umbralStock;
              const categoria = producto.categoria_id
                ? categoriasPorId.get(producto.categoria_id)
                : undefined;

              return (
                <li key={producto.id}>
                  <article className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-card transition-shadow duration-200 hover:shadow-md">
                    <button
                      type="button"
                      onClick={() => abrirEditar(producto)}
                      aria-label={`Editar ${producto.nombre}`}
                      className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                    />

                    <div className="relative h-40 bg-surface-container sm:h-44">
                      {producto.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={producto.foto_url}
                          alt={producto.nombre}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-on-surface-variant/50">
                          <Icon name="inventory_2" size={48} strokeWidth={1.3} />
                        </span>
                      )}

                      {categoria && (
                        <span className="absolute left-3 top-3 max-w-[62%] truncate rounded-full bg-surface-container-lowest/90 px-2.5 py-1 text-label-sm text-on-surface backdrop-blur-sm">
                          {categoria}
                        </span>
                      )}

                      <span
                        className={cn(
                          "absolute right-3 top-3 rounded-full px-2.5 py-1 text-label-sm tabular-nums backdrop-blur-sm",
                          agotado
                            ? "bg-status-vencida-bg/90 text-status-vencida-text"
                            : bajo
                              ? "bg-status-por-vencer-bg/90 text-status-por-vencer-text"
                              : "bg-status-pagada-bg/90 text-status-pagada-text"
                        )}
                      >
                        {agotado ? "Agotado" : `${producto.cantidad} u.`}
                      </span>

                      <span className="absolute bottom-3 right-3 flex h-9 w-9 translate-y-1 items-center justify-center rounded-full bg-inverse-surface/85 text-inverse-on-surface opacity-0 shadow-md backdrop-blur-sm transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                        <Icon name="edit" size={17} />
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <p className="truncate text-label-sm uppercase tracking-wider text-primary">
                        {categoria ?? "Sin categoría"}
                      </p>
                      <h3 className="mt-1 line-clamp-2 text-body-lg font-semibold text-on-surface">
                        {producto.nombre}
                      </h3>
                      <p className="mt-0.5 text-body-sm tabular-nums text-on-surface-variant">
                        {producto.codigo}
                      </p>

                      <div className="mt-auto flex items-end justify-between gap-3 border-t border-outline-variant pt-3.5">
                        <div>
                          <p className="text-label-sm text-on-surface-variant">Precio</p>
                          <p className="text-numeric-currency tabular-nums text-on-surface">
                            {formatUsd(producto.precio_usd)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "flex items-center gap-1.5 text-label-sm",
                            agotado
                              ? "text-status-vencida-text"
                              : bajo
                                ? "text-status-por-vencer-text"
                                : "text-status-pagada-text"
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                          {agotado ? "Agotado" : bajo ? "Stock bajo" : "Disponible"}
                        </span>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>

          <Pagination
            pagina={pagina}
            total={total}
            porPagina={POR_PAGINA}
            onCambiar={cambiarPagina}
            cargando={cargando}
          />
        </>
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

          <Select
            label="Categoría"
            name="categoria_id"
            value={form.categoria_id}
            onChange={(e) => setForm((f) => ({ ...f, categoria_id: e.target.value }))}
            error={errores.categoria_id}
            placeholder="Sin categoría"
            options={categorias.map((categoria) => ({
              value: categoria.id,
              label: categoria.nombre,
            }))}
          />

          {!agregandoCategoria ? (
            <button
              type="button"
              onClick={() => {
                setAgregandoCategoria(true);
                setErrorCategoria(undefined);
              }}
              className="-mt-1 flex items-center gap-1.5 self-start rounded-md px-1 py-1 text-label-md text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Icon name="add" size={16} />
              Nueva categoría
            </button>
          ) : (
            <div className="rounded-lg bg-surface-container-low p-3">
              <div className="flex items-end gap-2">
                <Input
                  label="Nueva categoría"
                  name="nueva_categoria"
                  placeholder="Ej. Aceites"
                  value={nuevaCategoria}
                  onChange={(e) => {
                    setNuevaCategoria(e.target.value);
                    setErrorCategoria(undefined);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      guardarCategoriaRapida();
                    }
                  }}
                  error={errorCategoria}
                  autoFocus
                />
                <Button
                  variant="secondary"
                  onClick={guardarCategoriaRapida}
                  loading={creandoCategoria}
                  className="shrink-0"
                >
                  Crear
                </Button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAgregandoCategoria(false);
                  setNuevaCategoria("");
                  setErrorCategoria(undefined);
                }}
                className="mt-2 text-label-sm text-on-surface-variant hover:text-on-surface"
              >
                Cancelar
              </button>
            </div>
          )}

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
