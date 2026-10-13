-- ============================================================================
-- 0015 · Elimina el índice redundante `pagos_factura_id_monto_idx`
-- El índice FK `pagos_factura_id_idx` ya cubre el agrupado por factura; el
-- índice con `include (monto_usd)` solo añadía coste de escritura.
-- ============================================================================

drop index if exists public.pagos_factura_id_monto_idx;
