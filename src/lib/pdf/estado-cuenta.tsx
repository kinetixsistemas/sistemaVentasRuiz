import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { EstadoCuenta, FacturaEstadoCuenta } from "@/features/cobranza/estado-cuenta";

const formatearUsd = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
});

const metodos: Record<string, string> = {
  bs: "Bolívares",
  efectivo: "Efectivo",
  zelle: "Zelle",
  binance: "Binance",
};

const estilos = StyleSheet.create({
  pagina: {
    fontFamily: "Helvetica",
    padding: 32,
    fontSize: 9,
    color: "#111827",
  },
  titulo: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  subtitulo: { fontSize: 10, color: "#374151", marginBottom: 16 },
  encabezadoEmpresa: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  empresaNombre: { fontSize: 13, fontWeight: "bold" },
  empresaDetalle: { fontSize: 8, color: "#4b5563" },
  encabezadoDerecha: { textAlign: "right" },
  bloqueCliente: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 8,
    marginBottom: 16,
  },
  filaCliente: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  clienteCampo: { fontWeight: "bold" },
  tabla: { flexDirection: "column", width: "100%" },
  filaEncabezado: {
    flexDirection: "row",
    backgroundColor: "#111827",
    color: "#ffffff",
    paddingVertical: 4,
  },
  fila: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#e5e7eb", paddingVertical: 3 },
  celdaNumero: { width: "22%" },
  celdaFecha: { width: "13%" },
  celdaVencimiento: { width: "13%" },
  celdaCondicion: { width: "12%" },
  celdaTotal: { width: "13%", textAlign: "right" },
  celdaPagado: { width: "13%", textAlign: "right" },
  celdaSaldo: { width: "14%", textAlign: "right" },
  pago: { paddingLeft: 8, color: "#4b5563", fontSize: 8, marginBottom: 1 },
  resumen: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
    fontSize: 11,
    fontWeight: "bold",
  },
  pie: { marginTop: 24, color: "#6b7280", fontSize: 8, textAlign: "center" },
});

export function EstadoCuentaPDF({ estado }: { estado: EstadoCuenta }) {
  return (
    <Document>
      <Page size="LETTER" style={estilos.pagina} wrap>
        {estado.empresa && (
          <View style={estilos.encabezadoEmpresa}>
            <View>
              <Text style={estilos.empresaNombre}>{estado.empresa.nombre_comercial}</Text>
              {estado.empresa.razon_social ? (
                <Text style={estilos.empresaDetalle}>{estado.empresa.razon_social}</Text>
              ) : null}
              {estado.empresa.rif ? (
                <Text style={estilos.empresaDetalle}>RIF: {estado.empresa.rif}</Text>
              ) : null}
              {estado.empresa.direccion ? (
                <Text style={estilos.empresaDetalle}>{estado.empresa.direccion}</Text>
              ) : null}
            </View>
            <View style={estilos.encabezadoDerecha}>
              {estado.empresa.telefono ? (
                <Text style={estilos.empresaDetalle}>Tel: {estado.empresa.telefono}</Text>
              ) : null}
              {estado.empresa.correo ? (
                <Text style={estilos.empresaDetalle}>{estado.empresa.correo}</Text>
              ) : null}
            </View>
          </View>
        )}

        <Text style={estilos.titulo}>Estado de cuenta</Text>
        <Text style={estilos.subtitulo}>Generado el {estado.generado_el}</Text>

        <View style={estilos.bloqueCliente}>
          <View style={estilos.filaCliente}>
            <Text style={estilos.clienteCampo}>{estado.cliente.nombre_juridico}</Text>
            <Text>RIF: {estado.cliente.rif}</Text>
          </View>
          <View style={estilos.filaCliente}>
            <Text>{estado.cliente.direccion}</Text>
            <Text>Teléfono: {estado.cliente.telefono}</Text>
          </View>
        </View>

        <EncabezadoFactura />

        {estado.facturas.map((factura) => (
          <FacturaFila key={factura.factura_id} factura={factura} />
        ))}

        <View style={estilos.resumen}>
          <Text>Saldo pendiente total: {formatearUsd.format(estado.saldo_pendiente_total)}</Text>
        </View>

        <Text style={estilos.pie} fixed>
          {estado.empresa?.nombre_comercial ?? "Sistema de inventario, ventas y cobranza"}
        </Text>
      </Page>
    </Document>
  );
}

function EncabezadoFactura() {
  return (
<View style={estilos.filaEncabezado}>
          <Text style={estilos.celdaNumero}>N° Factura</Text>
          <Text style={estilos.celdaFecha}>Emisión</Text>
          <Text style={estilos.celdaVencimiento}>Vence</Text>
          <Text style={estilos.celdaCondicion}>Condición</Text>
          <Text style={estilos.celdaTotal}>Total</Text>
          <Text style={estilos.celdaPagado}>Pagado</Text>
          <Text style={estilos.celdaSaldo}>Saldo</Text>
        </View>
  );
}

function FacturaFila({ factura }: { factura: FacturaEstadoCuenta }) {
  const ok = (n: number) => formatearUsd.format(n);
  return (
    <View>
      <View style={estilos.fila}>
        <Text style={estilos.celdaNumero}>{factura.numero_factura}</Text>
        <Text style={estilos.celdaFecha}>{factura.fecha_emision}</Text>
        <Text style={estilos.celdaVencimiento}>{factura.fecha_vencimiento}</Text>
        <Text style={estilos.celdaCondicion}>{factura.condicion}</Text>
        <Text style={estilos.celdaTotal}>{ok(factura.total_usd)}</Text>
        <Text style={estilos.celdaPagado}>{ok(factura.pagado_usd)}</Text>
        <Text style={estilos.celdaSaldo}>{ok(factura.saldo_usd)}</Text>
      </View>
      {factura.pagos.map((pago) => (
        <Text key={`${factura.factura_id}-${pago.fecha}-${pago.monto_usd}`} style={estilos.pago}>
          Pago {pago.fecha} · {metodos[pago.metodo] ?? pago.metodo} · {ok(pago.monto_usd)}
          {pago.referencia ? ` · ${pago.referencia}` : ""}
        </Text>
      ))}
    </View>
  );
}