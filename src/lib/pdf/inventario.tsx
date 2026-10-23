import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Empresa } from "@/features/empresa/schemas";
import type { Categoria, ExistenciaFiltro, Producto } from "@/features/inventario/schemas";

const formatearUsd = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});

const FILTRO_LABEL: Record<ExistenciaFiltro, string> = {
  todo: "Todos los productos",
  con: "Productos con existencia",
  sin: "Productos sin existencia",
};

const estilos = StyleSheet.create({
  pagina: {
    fontFamily: "Helvetica",
    padding: 28,
    fontSize: 9,
    color: "#111827",
  },
  encabezadoEmpresa: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  empresaNombre: { fontSize: 13, fontWeight: "bold" },
  empresaDetalle: { fontSize: 8, color: "#4b5563", marginTop: 1 },
  encabezadoDerecha: { textAlign: "right" },
  titulo: { fontSize: 17, fontWeight: "bold", marginBottom: 2 },
  subtitulo: { fontSize: 9, color: "#4b5563", marginBottom: 12 },
  tarjetas: { flexDirection: "row", gap: 8, marginBottom: 14 },
  tarjeta: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: "#d1d5db",
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tarjetaLabel: { fontSize: 7, color: "#6b7280", textTransform: "uppercase" },
  tarjetaValor: { fontSize: 12, fontWeight: "bold", marginTop: 2 },
  tabla: { flexDirection: "column", width: "100%" },
  filaEncabezado: {
    flexDirection: "row",
    backgroundColor: "#111827",
    color: "#ffffff",
    paddingVertical: 5,
  },
  fila: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#e5e7eb",
    paddingVertical: 4,
  },
  celdaCodigo: { width: "13%", paddingHorizontal: 3 },
  celdaProducto: { width: "31%", paddingHorizontal: 3 },
  celdaCategoria: { width: "18%", paddingHorizontal: 3 },
  celdaCantidad: { width: "10%", paddingHorizontal: 3, textAlign: "right" },
  celdaPrecio: { width: "13%", paddingHorizontal: 3, textAlign: "right" },
  celdaValor: { width: "15%", paddingHorizontal: 3, textAlign: "right" },
  agotado: { color: "#b3261e" },
  pie: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#9ca3af",
  },
});

export function InventarioPDF({
  productos,
  categorias,
  empresa,
  existencia,
  categoria,
  busqueda,
  generadoEl,
}: {
  productos: Producto[];
  categorias: Categoria[];
  empresa: Empresa | null;
  existencia: ExistenciaFiltro;
  categoria?: string;
  busqueda?: string;
  generadoEl: string;
}) {
  const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]));
  const totalUnidades = productos.reduce((total, p) => total + p.cantidad, 0);
  const valorInventario = productos.reduce((total, p) => total + p.cantidad * p.precio_usd, 0);

  return (
    <Document>
      <Page size="LETTER" style={estilos.pagina} wrap>
        {empresa && (
          <View style={estilos.encabezadoEmpresa}>
            <View>
              <Text style={estilos.empresaNombre}>{empresa.nombre_comercial}</Text>
              {empresa.razon_social ? (
                <Text style={estilos.empresaDetalle}>{empresa.razon_social}</Text>
              ) : null}
              {empresa.rif ? <Text style={estilos.empresaDetalle}>RIF: {empresa.rif}</Text> : null}
              {empresa.direccion ? (
                <Text style={estilos.empresaDetalle}>{empresa.direccion}</Text>
              ) : null}
            </View>
            <View style={estilos.encabezadoDerecha}>
              {empresa.telefono ? (
                <Text style={estilos.empresaDetalle}>Tel: {empresa.telefono}</Text>
              ) : null}
              {empresa.correo ? (
                <Text style={estilos.empresaDetalle}>{empresa.correo}</Text>
              ) : null}
            </View>
          </View>
        )}

        <Text style={estilos.titulo}>Inventario</Text>
        <Text style={estilos.subtitulo}>
          Generado el {generadoEl} · {FILTRO_LABEL[existencia]}
          {categoria ? ` · Categoría: ${categoria}` : ""}
          {busqueda ? ` · Búsqueda: “${busqueda}”` : ""}
        </Text>

        <View style={estilos.tarjetas}>
          <View style={estilos.tarjeta}>
            <Text style={estilos.tarjetaLabel}>Productos</Text>
            <Text style={estilos.tarjetaValor}>{productos.length}</Text>
          </View>
          <View style={estilos.tarjeta}>
            <Text style={estilos.tarjetaLabel}>Unidades</Text>
            <Text style={estilos.tarjetaValor}>{totalUnidades}</Text>
          </View>
          <View style={estilos.tarjeta}>
            <Text style={estilos.tarjetaLabel}>Valor del inventario</Text>
            <Text style={estilos.tarjetaValor}>{formatearUsd.format(valorInventario)}</Text>
          </View>
        </View>

        <View style={estilos.tabla}>
          <View style={estilos.filaEncabezado} fixed>
            <Text style={estilos.celdaCodigo}>Código</Text>
            <Text style={estilos.celdaProducto}>Producto</Text>
            <Text style={estilos.celdaCategoria}>Categoría</Text>
            <Text style={estilos.celdaCantidad}>Existencias</Text>
            <Text style={estilos.celdaPrecio}>Precio</Text>
            <Text style={estilos.celdaValor}>Valor</Text>
          </View>

          {productos.map((producto) => (
            <View key={producto.id} style={estilos.fila}>
              <Text style={estilos.celdaCodigo}>{producto.codigo}</Text>
              <Text style={estilos.celdaProducto}>{producto.nombre}</Text>
              <Text style={estilos.celdaCategoria}>
                {producto.categoria_id
                  ? (nombreCategoria.get(producto.categoria_id) ?? "Sin categoría")
                  : "Sin categoría"}
              </Text>
              <Text
                style={[estilos.celdaCantidad, producto.cantidad === 0 ? estilos.agotado : {}]}
              >
                {producto.cantidad}
              </Text>
              <Text style={estilos.celdaPrecio}>{formatearUsd.format(producto.precio_usd)}</Text>
              <Text style={estilos.celdaValor}>
                {formatearUsd.format(producto.cantidad * producto.precio_usd)}
              </Text>
            </View>
          ))}
        </View>

        <View style={estilos.pie} fixed>
          <Text>{empresa?.nombre_comercial ?? "Sistema de inventario, ventas y cobranza"}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
