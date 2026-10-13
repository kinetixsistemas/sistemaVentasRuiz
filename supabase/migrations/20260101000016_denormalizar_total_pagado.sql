-- ============================================================================
-- 0016 · Desnormalizar facturas.total_pagado_usd
--
-- Motivos:
--   - La vista facturas_con_saldo y resumen_cartera agrupaban TODOS los pagos
--     (GROUP BY factura_id) en cada consulta, sin poder apoyarse en índices.
--   - Se guarda el total pagado en la factura y se mantiene con un trigger
--     sobre pagos. El saldo y el estado siguen siendo derivados.
--
-- Nota: la aplicación sigue considerando las facturas inmutables (no existe
-- política de UPDATE sobre facturas). El único escritor de total_pagado_usd es
-- el trigger, que corre como SECURITY DEFINER (dueño postgres) para saltar RLS.
-- ============================================================================

-- ---- 1. Columna denormalizada + backfill ----------------------------------
alter table public.facturas
  add column total_pagado_usd numeric(12,2) not null default 0;

update public.facturas f
   set total_pagado_usd = p.total
  from (
    select factura_id, sum(monto_usd)::numeric(12,2) as total
    from public.pagos
    group by factura_id
  ) p
 where p.factura_id = f.id;

comment on column public.facturas.total_pagado_usd is
  'Total pagado (USD). Mantenido por el trigger pagos_actualizar_total_pagado.';

-- ---- 2. Trigger que mantiene el total -------------------------------------
create or replace function public.actualizar_total_pagado_factura()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_factura_id uuid := coalesce(new.factura_id, old.factura_id);
begin
  -- Recalcula desde cero: idempotente y soporta INSERT/UPDATE/DELETE.
  update public.facturas f
     set total_pagado_usd = coalesce((
       select sum(p.monto_usd) from public.pagos p where p.factura_id = v_factura_id
     ), 0)::numeric(12,2)
   where f.id = v_factura_id;
  return null;
end;
$$;

comment on function public.actualizar_total_pagado_factura() is
  'Mantiene facturas.total_pagado_usd a partir de public.pagos.';

revoke all on function public.actualizar_total_pagado_factura() from public, anon, authenticated;

create trigger pagos_actualizar_total_pagado
  after insert or update or delete on public.pagos
  for each row execute function public.actualizar_total_pagado_factura();

-- ---- 3. Vista usa la columna (sin agrupar pagos) --------------------------
create or replace view public.facturas_con_saldo
with (security_invoker = true)
as
select
  f.id,
  f.numero_factura,
  f.cliente_id,
  c.rif,
  c.nombre_juridico,
  c.vendedor,
  f.fecha_emision,
  f.condicion,
  f.dias_credito,
  f.fecha_vencimiento,
  f.total_usd,
  f.total_pagado_usd,
  round(f.total_usd - f.total_pagado_usd, 2)                  as saldo_usd,
  case
    when f.total_usd - f.total_pagado_usd <= 0.005 then 'pagada'
    when f.fecha_vencimiento < (now() at time zone 'America/Caracas')::date then 'vencida'
    when f.fecha_vencimiento <= (now() at time zone 'America/Caracas')::date + 5 then 'por_vencer'
    else 'pendiente'
  end                                                          as estado,
  case
    when f.total_usd - f.total_pagado_usd <= 0.005 then 0
    else greatest(0, (now() at time zone 'America/Caracas')::date - f.fecha_vencimiento)
  end                                                          as dias_mora,
  f.created_at
from public.facturas f
join public.clientes c on c.id = f.cliente_id;

comment on view public.facturas_con_saldo is
  'Facturas con total pagado, saldo, estado (pagada|vencida|por_vencer|pendiente) y días de mora calculados.';

-- ---- 4. resumen_cartera usa la columna ------------------------------------
create or replace function public.resumen_cartera()
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$
  with saldos as (
    select
      round(f.total_usd - f.total_pagado_usd, 2) as saldo,
      case
        when f.total_usd - f.total_pagado_usd <= 0.005 then 'pagada'
        when f.fecha_vencimiento < (now() at time zone 'America/Caracas')::date then 'vencida'
        when f.fecha_vencimiento <= (now() at time zone 'America/Caracas')::date + 5 then 'por_vencer'
        else 'pendiente'
      end as estado
    from public.facturas f
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
