-- ============================================================================
-- 0018 · RPC resumen_ventas_periodo
-- KPIs de ventas por período (total vendido y total recaudado) calculados en
-- la BD, para el selector de mes de la pantalla de Ventas.
--   - Vendido: suma de total_usd de facturas emitidas en el período.
--   - Recaudado: suma de monto_usd de pagos con fecha dentro del período.
-- ============================================================================

-- Índice para sumar pagos por rango de fecha (los KPIs del período).
create index if not exists pagos_fecha_idx
  on public.pagos (fecha);

create or replace function public.resumen_ventas_periodo(
  p_desde date,
  p_hasta date
)
returns jsonb
language plpgsql
security invoker
stable
set search_path = ''
as $$
declare
  v_vendido   numeric(14,2);
  v_recaudado numeric(14,2);
begin
  if p_desde is null or p_hasta is null or p_desde > p_hasta then
    raise exception 'El período indicado no es válido' using errcode = 'KX002';
  end if;

  select coalesce(sum(f.total_usd), 0) into v_vendido
  from public.facturas f
  where f.fecha_emision between p_desde and p_hasta;

  select coalesce(sum(p.monto_usd), 0) into v_recaudado
  from public.pagos p
  where p.fecha between p_desde and p_hasta;

  return jsonb_build_object(
    'total_vendido_usd', round(v_vendido, 2),
    'total_recaudado_usd', round(v_recaudado, 2)
  );
end;
$$;

comment on function public.resumen_ventas_periodo(date, date) is
  'Totales vendidos y recaudados (USD) en un período, calculados en la BD.';

revoke all on function public.resumen_ventas_periodo(date, date) from public, anon;
grant execute on function public.resumen_ventas_periodo(date, date) to authenticated;