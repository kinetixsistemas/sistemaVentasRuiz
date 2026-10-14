import { renderToBuffer } from "@react-pdf/renderer";
import { EstadoCuentaPDF } from "./estado-cuenta";
import { obtenerEstadoCuentaRepo, type RangoEstadoCuenta } from "@/features/cobranza/estado-cuenta";

/** Renderiza el PDF del estado de cuenta de un cliente (entorno Node). */
export async function renderEstadoCuentaPdf(
  clienteId: string,
  rango?: RangoEstadoCuenta
): Promise<Buffer> {
  const estado = await obtenerEstadoCuentaRepo(clienteId, rango);
  return renderToBuffer(<EstadoCuentaPDF estado={estado} />);
}