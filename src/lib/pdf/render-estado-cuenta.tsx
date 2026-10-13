import { renderToBuffer } from "@react-pdf/renderer";
import { EstadoCuentaPDF } from "./estado-cuenta";
import { obtenerEstadoCuentaRepo } from "@/features/cobranza/estado-cuenta";

/** Renderiza el PDF del estado de cuenta de un cliente (entorno Node). */
export async function renderEstadoCuentaPdf(clienteId: string): Promise<Buffer> {
  const estado = await obtenerEstadoCuentaRepo(clienteId);
  return renderToBuffer(<EstadoCuentaPDF estado={estado} />);
}