-- ============================================================================
-- 0022 · Comisiones de vendedores
-- Registra la comisión pagada por cada factura. El porcentaje y el monto se
-- congelan en el momento del pago; cambiar el % del vendedor no altera pagos
-- anteriores. La comisión solo puede registrarse cuando la factura está
-- totalmente pagada.
-- Códigos de error: KX002 (datos inválidos), KX003 (factura no pagada o
-- comisión ya registrada), KX004 (factura inexistente).
-- ============================================================================

-- ---- 1. Tabla de comisiones pagadas --------------------------------------
create table public.comisiones_vendedor (
  id            uuid primary key default gen_random_uuid(),
  factura_id    uuid not null references public.facturas(id) on delete restrict,
  vendedor_id   uuid not null references public.vendedores(id) on delete restrict,
  base_usd      numeric(12,2) not null,
  comision_pct  numeric(5,2) not null,
  monto_usd     numeric(12,2) not null,
  pagada_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint comisiones_vendedor_factura_id_key unique (factura_id),
  constraint comisiones_vendedor_base_check check (base_usd >= 0),
  constraint comisiones_vendedor_pct_check check (comision_pct between 0 and 100),
  constraint comisiones_vendedor_monto_check check (monto_usd >= 0)
);

comment on table public.comisiones_vendedor is
  'Comisiones pagadas a vendedores, una por factura, con % y monto congelados.';
comment on column public.comisiones_vendedor.base_usd is
  'Total de la factura usado como base para el cálculo.';
comment on column public.comisiones_vendedor.pagada_at is
  'Fecha en que se registró el pago de la comisión.';

create index comisiones_vendedor_vendedor_id_idx
  on public.comisiones_vendedor (vendedor_id);

create trigger comisiones_vendedor_set_updated_at
  before update on public.comisiones_vendedor
  for each row execute function public.set_updated_at();

-- ---- 2. RPC para pagar la comisión de una factura ------------------------
-- SECURITY DEFINER: la tabla no permite INSERT directo; toda comisión debe
-- pasar por esta validación. La función es la única vía de escritura.
create or replace function public.pagar_comision_vendedor(
  p_factura_id    uuid,
  p_comision_pct  numeric
)
returns table (
  comision_id   uuid,
  factura_id    uuid,
  vendedor_id   uuid,
  base_usd      numeric,
  comision_pct  numeric,
  monto_usd     numeric,
  pagada_at     timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vendedor_id uuid;
  v_total       numeric(12,2);
  v_pagado      numeric(12,2);
  v_monto       numeric(12,2);
  v_comision_id uuid;
  v_pagada_at   timestamptz;
begin
  -- Evita registrar dos veces la comisión si se hace doble clic/concurrencia.
  perform pg_advisory_xact_lock(hashtextextended(p_factura_id::text, 0));

  select f.vendedor_id, f.total_usd, f.total_pagado_usd
    into v_vendedor_id, v_total, v_pagado
    from public.facturas f
   where f.id = p_factura_id;

  if not found then
    raise exception 'La factura no existe' using errcode = 'KX004';
  end if;

  if v_total - v_pagado > 0.005 then
    raise exception 'La factura aún no está totalmente pagada' using errcode = 'KX003';
  end if;

  if exists (
    select 1
      from public.comisiones_vendedor c
     where c.factura_id = p_factura_id
  ) then
    raise exception 'La comisión de esta factura ya fue registrada' using errcode = 'KX003';
  end if;

  if p_comision_pct is null or p_comision_pct < 0 or p_comision_pct > 100 then
    raise exception 'El porcentaje de comisión debe estar entre 0 y 100' using errcode = 'KX002';
  end if;

  if p_comision_pct <> round(p_comision_pct, 2) then
    raise exception 'El porcentaje de comisión admite máximo 2 decimales' using errcode = 'KX002';
  end if;

  v_monto := round(v_total * p_comision_pct / 100, 2);

  insert into public.comisiones_vendedor (
    factura_id,
    vendedor_id,
    base_usd,
    comision_pct,
    monto_usd,
    pagada_at
  )
  values (
    p_factura_id,
    v_vendedor_id,
    v_total,
    p_comision_pct,
    v_monto,
    now()
  )
  returning id, pagada_at into v_comision_id, v_pagada_at;

  return query
  select
    v_comision_id,
    p_factura_id,
    v_vendedor_id,
    v_total,
    p_comision_pct,
    v_monto,
    v_pagada_at;
end;
$$;

comment on function public.pagar_comision_vendedor(uuid, numeric) is
  'Registra la comisión pagada de una factura totalmente cobrada, congelando % y monto.';

-- ---- 3. Resumen por vendedor con comisiones pagadas/pendientes -----------
-- La comisión pendiente es una estimación con el % actual del vendedor; las
-- comisiones ya pagadas conservan su % y monto históricos.
drop function if exists public.resumen_vendedores(date, date);

create function public.resumen_vendedores(
  p_desde date default null,
  p_hasta date default null
)
returns table (
  id                    uuid,
  nombre                text,
  comision_pct          numeric,
  activo                boolean,
  facturas_periodo      integer,
  pagadas_periodo       integer,
  pendientes_periodo    integer,
  vendido_periodo_usd   numeric,
  cobrado_periodo_usd   numeric,
  saldo_periodo_usd     numeric,
  facturas_total        integer,
  pagadas_total         integer,
  vendido_total_usd     numeric,
  comision_total_usd    numeric,
  comision_pagada_usd   numeric,
  comision_pendiente_usd numeric,
  comisiones_pagadas    integer
)
language plpgsql
security invoker
stable
set search_path = ''
as $$
begin
  if p_desde is not null and p_hasta is not null and p_desde > p_hasta then
    raise exception 'El rango de fechas no es válido' using errcode = 'KX002';
  end if;

  return query
  with periodo as (
    select
      f.vendedor_id,
      count(*)::integer as facturas,
      count(*) filter (where f.total_usd - f.total_pagado_usd <= 0.005)::integer as pagadas,
      count(*) filter (where f.total_usd - f.total_pagado_usd > 0.005)::integer as pendientes,
      coalesce(sum(f.total_usd), 0)::numeric(12,2) as vendido,
      coalesce(sum(f.total_pagado_usd), 0)::numeric(12,2) as cobrado,
      coalesce(sum(f.total_usd - f.total_pagado_usd), 0)::numeric(12,2) as saldo
    from public.facturas f
    where (p_desde is null or f.fecha_emision >= p_desde)
      and (p_hasta is null or f.fecha_emision <= p_hasta)
    group by f.vendedor_id
  ),
  historico as (
    select
      f.vendedor_id,
      count(*)::integer as facturas,
      count(*) filter (where f.total_usd - f.total_pagado_usd <= 0.005)::integer as pagadas,
      coalesce(sum(f.total_usd), 0)::numeric(12,2) as vendido
    from public.facturas f
    group by f.vendedor_id
  ),
  comisiones as (
    select
      c.vendedor_id,
      count(*)::integer as pagadas,
      coalesce(sum(c.monto_usd), 0)::numeric(12,2) as pagado
    from public.comisiones_vendedor c
    group by c.vendedor_id
  ),
  pendientes as (
    select
      f.vendedor_id,
      coalesce(sum(f.total_usd), 0)::numeric(12,2) as base
    from public.facturas f
    left join public.comisiones_vendedor c on c.factura_id = f.id
    where f.total_usd - f.total_pagado_usd <= 0.005
      and c.id is null
    group by f.vendedor_id
  )
  select
    v.id,
    v.nombre,
    v.comision_pct,
    v.activo,
    coalesce(p.facturas, 0),
    coalesce(p.pagadas, 0),
    coalesce(p.pendientes, 0),
    coalesce(p.vendido, 0),
    coalesce(p.cobrado, 0),
    coalesce(p.saldo, 0),
    coalesce(h.facturas, 0),
    coalesce(h.pagadas, 0),
    coalesce(h.vendido, 0),
    round(coalesce(com.pagado, 0) + round(coalesce(pend.base, 0) * v.comision_pct / 100, 2), 2),
    coalesce(com.pagado, 0),
    round(coalesce(pend.base, 0) * v.comision_pct / 100, 2),
    coalesce(com.pagadas, 0)
  from public.vendedores v
  left join periodo p on p.vendedor_id = v.id
  left join historico h on h.vendedor_id = v.id
  left join comisiones com on com.vendedor_id = v.id
  left join pendientes pend on pend.vendedor_id = v.id
  order by v.activo desc, v.nombre;
end;
$$;

comment on function public.resumen_vendedores(date, date) is
  'Métricas de facturación por período y comisiones pagadas/pendientes por vendedor.';

-- ---- 4. RLS y permisos ---------------------------------------------------
alter table public.comisiones_vendedor enable row level security;

create policy comisiones_vendedor_select on public.comisiones_vendedor
  for select to authenticated using (true);

revoke all on public.comisiones_vendedor from anon, public;
grant select on public.comisiones_vendedor to authenticated;

revoke all on function public.pagar_comision_vendedor(uuid, numeric) from public, anon;
grant execute on function public.pagar_comision_vendedor(uuid, numeric) to authenticated;

revoke all on function public.resumen_vendedores(date, date) from public, anon;
grant execute on function public.resumen_vendedores(date, date) to authenticated;
