-- ============================================================================
-- 0014 · Rendimiento: índices faltantes + RPC de resumen
--
-- Motivos:
--   - El panel de inicio traía TODAS las facturas y 100 productos solo para
--     calcular 3 sumas y mostrar 6 filas. Estas RPC calculan/limitan en la BD.
--   - Faltan índices para ordenar/filtrar por fecha de emisión y por created_at
--     de pagos (usados en listados y "últimos cobros").
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Índices de consulta frecuente
-- ----------------------------------------------------------------------------
create index if not exists facturas_fecha_emision_idx
  on public.facturas (fecha_emision desc);

create index if not exists pagos_created_at_idx
  on public.pagos (created_at desc);

-- ----------------------------------------------------------------------------
-- resumen_cartera(): KPIs del panel calculados en la BD, sin transferir filas.
-- SECURITY INVOKER → respeta RLS del usuario autenticado.
-- ----------------------------------------------------------------------------
create or replace function public.resumen_cartera()
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$
  with saldos as (
    select
      round(f.total_usd - coalesce(p.total_pagado, 0), 2) as saldo,
      case
        when f.total_usd - coalesce(p.total_pagado, 0) <= 0.005 then 'pagada'
        when f.fecha_vencimiento < (now() at time zone 'America/Caracas')::date then 'vencida'
        when f.fecha_vencimiento <= (now() at time zone 'America/Caracas')::date + 5 then 'por_vencer'
        else 'pendiente'
      end as estado
    from public.facturas f
    left join (
      select factura_id, sum(monto_usd) as total_pagado
      from public.pagos
      group by factura_id
    ) p on p.factura_id = f.id
  )
  select jsonb_build_object(
    'por_cobrar_usd',       coalesce(sum(saldo) filter (where estado <> 'pagada'), 0),
    'facturas_abiertas',    count(*) filter (where estado <> 'pagada'),
    'vencidas_usd',         coalesce(sum(saldo) filter (where estado = 'vencida'), 0),
    'facturas_vencidas',    count(*) filter (where estado = 'vencida'),
    'por_vencer_usd',       coalesce(sum(saldo) filter (where estado = 'por_vencer'), 0),
    'facturas_por_vencer',  count(*) filter (where estado = 'por_vencer')
  )
  from saldos;
$$;

comment on function public.resumen_cartera() is
  'KPIs de cartera (por cobrar, vencidas, por vencer) calculados en la BD.';

revoke all on function public.resumen_cartera() from public, anon;
grant execute on function public.resumen_cartera() to authenticated;

-- ----------------------------------------------------------------------------
-- productos_stock_bajo(): solo los productos con existencias bajas, limitados.
-- ----------------------------------------------------------------------------
create or replace function public.productos_stock_bajo(
  p_umbral integer,
  p_limite integer default 6
)
returns table (
  id         uuid,
  codigo     text,
  nombre     text,
  cantidad   integer,
  precio_usd numeric,
  foto_url   text
)
language sql
security invoker
stable
set search_path = ''
as $$
  select p.id, p.codigo, p.nombre, p.cantidad, p.precio_usd, p.foto_url
  from public.productos p
  where p.cantidad <= greatest(coalesce(p_umbral, 0), 0)
  order by p.cantidad asc, p.codigo asc
  limit greatest(coalesce(p_limite, 1), 1);
$$;

comment on function public.productos_stock_bajo(integer, integer) is
  'Productos con cantidad <= umbral, ordenados por existencia ascendente.';

revoke all on function public.productos_stock_bajo(integer, integer) from public, anon;
grant execute on function public.productos_stock_bajo(integer, integer) to authenticated;
