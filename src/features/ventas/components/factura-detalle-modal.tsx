"use client";

import { useEffect, useState, type ReactNode } from "react";
import { obtenerFactura } from "@/features/ventas/actions";
import type { FacturaDetalle } from "@/features/ventas/schemas";
import type { EstadoFactura } from "@/types/database";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { EstadoChip } from "@/components/ui/estado-chip";
import { Icon } from "@/components/ui/icon";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Modal } from "@/components/ui/modal";
import { formatFecha, formatUsd, labelCondicion, labelMetodoPago } from "@/components/ui/format";

/** Resumen de la factura (vista) que el modal muestra de inmediato. */
export type FacturaResumenModal = {
  id: string;
  numero_factura: string;
  estado: EstadoFactura;
  total_usd: number;
  total_pagado_usd: number;
  saldo_usd: number;
};

/**
 * Modal con la factura completa del cliente: montos, descuento, ítems y
 * abonos (o pago completo). Los ítems y pagos se cargan al abrir; el resumen
 * lo aporta quien lo invoca (viene de la vista `facturas_con_saldo`).
 */
export function FacturaDetalleModal({
  factura,
  onClose,
  accion,
}: {
  /** Factura a mostrar; null para cerrar el modal. */
  factura: FacturaResumenModal | null;
  onClose: () => void;
  /** Acción principal del pie (p. ej. "Registrar pago"). */
  accion?: ReactNode;
}) {
  // El resultado se guarda junto al id consultado para no marcar "cargando"
  // con datos de otra factura (evita setState síncrono dentro del efecto).
  const [resultado, setResultado] = useState<{
    facturaId: string;
    detalle: FacturaDetalle | null;
    error: string | null;
  } | null>(null);

  const facturaId = factura?.id ?? null;

  useEffect(() => {
    if (!facturaId) return;
    let activo = true;
    void obtenerFactura({ id: facturaId }).then((res) => {
      if (!activo) return;
      setResultado(
        res.ok
          ? { facturaId, detalle: res.data, error: null }
          : { facturaId, detalle: null, error: res.error.message }
      );
    });
    return () => {
      activo = false;
    };
  }, [facturaId]);

  const cargando = facturaId !== null && resultado?.facturaId !== facturaId;
  const detalle = resultado?.facturaId === facturaId ? resultado.detalle : null;
  const error = resultado?.facturaId === facturaId ? resultado.error : null;

  function cerrar() {
    setResultado(null);
    onClose();
  }

  return (
    <Modal
      open={factura !== null}
      onClose={cerrar}
      title={factura ? `Factura ${factura.numero_factura}` : ""}
      size="md"
      footer={accion}
    >
      {factura && (
        <div className="flex flex-col gap-4">
          {cargando ? (
            <p className="py-6 text-center text-body-sm text-on-surface-variant">Cargando detalle…</p>
          ) : error ? (
            <InlineAlert>{error}</InlineAlert>
          ) : detalle ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-headline-sm text-on-surface">
                    {detalle.cliente.nombre_juridico}
                  </p>
                  <p className="truncate text-body-sm tabular-nums text-on-surface-variant">
                    {detalle.cliente.rif}
                  </p>
                </div>
                <EstadoChip estado={factura.estado} className="shrink-0" />
              </div>

              <div className="flex flex-col gap-2">
                <div className="rounded-lg bg-surface-container px-3.5 py-2.5">
                  <p className="text-label-sm text-on-surface-variant">Condición de pago</p>
                  <p className="text-label-md text-on-surface">
                    {labelCondicion(detalle.condicion)}
                    {detalle.condicion === "credito" && detalle.dias_credito > 0
                      ? ` · ${detalle.dias_credito} días`
                      : ""}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-surface-container px-3.5 py-2.5">
                    <p className="text-label-sm text-on-surface-variant">Emitida</p>
                    <p className="text-label-md tabular-nums text-on-surface">
                      {formatFecha(detalle.fecha_emision)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-container px-3.5 py-2.5">
                    <p className="text-label-sm text-on-surface-variant">Vence</p>
                    <p className="text-label-md tabular-nums text-on-surface">
                      {formatFecha(detalle.fecha_vencimiento)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Card contentClassName="flex flex-col gap-0.5 p-3">
                  <p className="text-label-md text-on-surface-variant">Total</p>
                  <p className="text-label-lg tabular-nums text-on-surface">
                    {formatUsd(factura.total_usd)}
                  </p>
                  {detalle.descuento_usd > 0 && (
                    <p className="text-body-sm tabular-nums text-on-surface-variant">
                      Descuento −{formatUsd(detalle.descuento_usd)}
                    </p>
                  )}
                </Card>
                <Card contentClassName="flex flex-col gap-0.5 p-3">
                  <p className="text-label-md text-on-surface-variant">Pagado</p>
                  <p className="text-label-lg tabular-nums text-on-surface">
                    {formatUsd(factura.total_pagado_usd)}
                  </p>
                </Card>
                <Card contentClassName="flex flex-col gap-0.5 p-3">
                  <p className="text-label-md text-on-surface-variant">Saldo</p>
                  <p
                    className={cn(
                      "truncate text-headline-sm tabular-nums",
                      factura.saldo_usd > 0.005 ? "text-primary" : "text-status-pagada-text"
                    )}
                  >
                    {formatUsd(factura.saldo_usd)}
                  </p>
                </Card>
              </div>

              {factura.saldo_usd <= 0.005 ? (
                <p className="flex items-center gap-2 rounded-lg bg-status-pagada-bg px-4 py-2.5 text-body-sm text-status-pagada-text">
                  <Icon name="check_circle" size={16} strokeWidth={2.2} />
                  Pago completo
                </p>
              ) : detalle.pagos.length > 0 ? (
                <p className="rounded-lg bg-surface-container px-4 py-2.5 text-body-sm text-on-surface-variant">
                  Pago parcial: restan{" "}
                  <span className="tabular-nums">{formatUsd(factura.saldo_usd)}</span>
                </p>
              ) : null}

              <div>
                <p className="mb-2 text-label-md text-on-surface-variant">
                  Productos ({detalle.items.length})
                </p>
                <Card contentClassName="p-0">
                  <ul className="divide-y divide-outline-variant">
                    {detalle.items.map((item) => (
                      <li key={item.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                        <span className="min-w-0 truncate text-body-md text-on-surface">
                          {item.producto?.nombre ?? "—"}
                          <span className="text-body-sm text-on-surface-variant">
                            {" "}· {item.cantidad} × {formatUsd(item.precio_unitario_usd)}
                          </span>
                        </span>
                        <span className="shrink-0 text-label-md tabular-nums text-on-surface">
                          {formatUsd(item.subtotal_usd)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              <div>
                <p className="mb-2 text-label-md text-on-surface-variant">
                  Abonos ({detalle.pagos.length})
                </p>
                {detalle.pagos.length === 0 ? (
                  <p className="rounded-lg bg-surface-container px-4 py-2.5 text-body-sm text-on-surface-variant">
                    {factura.saldo_usd > 0
                      ? "Sin abonos registrados: la factura está pendiente por completo."
                      : "Sin abonos registrados."}
                  </p>
                ) : (
                  <Card contentClassName="p-0">
                    <ul className="divide-y divide-outline-variant">
                      {detalle.pagos.map((pago) => (
                        <li key={pago.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                          <span className="min-w-0">
                            <span className="text-body-md text-on-surface">
                              {labelMetodoPago(pago.metodo)} · {formatFecha(pago.fecha)}
                            </span>
                            {(pago.moneda === "VES" && pago.tasa_cambio) || pago.referencia ? (
                              <span className="block text-body-sm tabular-nums text-on-surface-variant">
                                {pago.moneda === "VES" && pago.tasa_cambio
                                  ? `Bs ${pago.monto_original.toLocaleString("es-VE", { maximumFractionDigits: 2 })} · tasa ${pago.tasa_cambio.toLocaleString("es-VE", { maximumFractionDigits: 2 })}`
                                  : ""}
                                {pago.referencia ? `${pago.moneda === "VES" ? " · " : ""}Ref. ${pago.referencia}` : ""}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-label-md tabular-nums text-on-surface">
                            {formatUsd(pago.monto_usd)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>

              <a
                href={`/api/estado-cuenta/${detalle.cliente.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 items-center justify-center gap-2 rounded-lg bg-surface-container text-label-lg text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Icon name="download" size={18} />
                Estado de cuenta del cliente
              </a>
            </>
          ) : null}
        </div>
      )}
    </Modal>
  );
}