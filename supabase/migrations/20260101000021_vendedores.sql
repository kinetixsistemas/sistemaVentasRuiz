-- ============================================================================
-- 0021 · Vendedores
-- Convierte el vendedor de texto libre en una entidad con id y comisión.
--   - clientes.vendedor_id: vendedor actual del cliente (obligatorio).
--   - facturas.vendedor_id: snapshot del vendedor al emitir (inmutable).
--   - La comisión se calcula sobre las facturas totalmente pagadas, sin
--     importar la fecha; el rango de fechas solo filtra las métricas.
-- Códigos de error: KX002 (rango inválido / cliente sin vendedor).
-- ============================================================================

-- ---- 1. Tabla vendedores --------------------------------------------------
create table public.vendedores (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  comision_pct  numeric(5,2) not null default 0,
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint vendedores_nombre_nonempty check (length(btrim(nombre)) > 0),
  constraint vendedores_comision_rango check (comision_pct between 0 and 100)
);

comment on table public.vendedores is
  'Vendedores comerciales (independientes de los usuarios de login).';
comment on column public.vendedores.comision_pct is
  'Porcentaje de comisión (0-100) sobre facturas totalmente pagadas.';

create unique index vendedores_nombre_norm_key
  on public.vendedores (lower(btrim(nombre)));

create trigger vendedores_set_updated_at
  before update on public.vendedores
  for each row execute function public.set_updated_at();

-- ---- 2. Migrar los nombres existentes (deduplicados) ----------------------
insert into public.vendedores (nombre)
select distinct on (lower(btrim(vendedor))) btrim(vendedor)
from public.clientes
where length(btrim(vendedor)) > 0
order by lower(btrim(vendedor)), id
on conflict do nothing;

-- ---- 3. Clientes: vendedor_id --------------------------------------------
alter table public.clientes
  add column vendedor_id uuid references public.vendedores(id) on delete restrict;

update public.clientes c
   set vendedor_id = v.id
  from public.vendedores v
 where lower(btrim(c.vendedor)) = lower(btrim(v.nombre));

alter table public.clientes
  alter column vendedor_id set not null;

create index clientes_vendedor_id_idx
  on public.clientes (vendedor_id);

comment on column public.clientes.vendedor_id is
  'Vendedor actual del cliente. Se usa para las facturas nuevas.';

-- ---- 4. Facturas: snapshot del vendedor ----------------------------------
alter table public.facturas
  add column vendedor_id uuid references public.vendedores(id) on delete restrict;

update public.facturas f
   set vendedor_id = c.vendedor_id
  from public.clientes c
 where c.id = f.cliente_id;

alter table public.facturas
  alter column vendedor_id set not null;

create index facturas_vendedor_id_idx
  on public.facturas (vendedor_id);

comment on column public.facturas.vendedor_id is
  'Vendedor al momento de emitir la factura (histórico inmutable).';

-- Antes del INSERT, se toma el vendedor actual del cliente. Así cualquier
-- inserción directa (RPC o seed) queda con el snapshot correcto.
create or replace function public.facturas_set_vendedor_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_vendedor_id uuid;
begin
  v_vendedor_id := new.vendedor_id;

  if v_vendedor_id is null then
    select c.vendedor_id
      into v_vendedor_id
      from public.clientes c
     where c.id = new.cliente_id;
  end if;

  if v_vendedor_id is null then
    raise exception 'El cliente no tiene vendedor asignado' using errcode = 'KX002';
  end if;

  new.vendedor_id := v_vendedor_id;
  return new;
end;
$$;

create trigger facturas_set_vendedor_id
  before insert on public.facturas
  for each row execute function public.facturas_set_vendedor_id();

-- ---- 5. Vista facturas_con_saldo -----------------------------------------
-- Se conserva el orden de columnas y se agrega vendedor_id al final para que
-- `create or replace view` siga siendo válido.
create or replace view public.facturas_con_saldo
with (security_invoker = true)
as
select
  f.id,
  f.numero_factura,
  f.cliente_id,
  c.rif,
  c.nombre_juridico,
  v.nombre                                                    as vendedor,
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
  f.created_at,
  f.vendedor_id
from public.facturas f
join public.clientes c on c.id = f.cliente_id
join public.vendedores v on v.id = f.vendedor_id;

comment on view public.facturas_con_saldo is
  'Facturas con total pagado, saldo, estado (pagada|vencida|por_vencer|pendiente), días de mora y vendedor snapshot.';

-- La vista ya no depende de clientes.vendedor; se puede eliminar el texto.
alter table public.clientes
  drop column vendedor;

-- ---- 6. Resumen por vendedor ---------------------------------------------
-- Las métricas del período filtran por fecha_emision. La comisión es
-- histórica: suma todas las facturas totalmente pagadas del vendedor.
create or replace function public.resumen_vendedores(
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
  comision_usd          numeric
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
      coalesce(sum(f.total_usd), 0)::numeric(12,2) as vendido,
      coalesce(
        sum(f.total_usd) filter (where f.total_usd - f.total_pagado_usd <= 0.005),
        0
      )::numeric(12,2) as pagado
    from public.facturas f
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
    round(coalesce(h.pagado, 0) * v.comision_pct / 100, 2)
  from public.vendedores v
  left join periodo p on p.vendedor_id = v.id
  left join historico h on h.vendedor_id = v.id
  order by v.activo desc, v.nombre;
end;
$$;

comment on function public.resumen_vendedores(date, date) is
  'Métricas de facturación por período y comisión histórica sobre facturas pagadas.';

-- ---- 7. RLS y permisos ----------------------------------------------------
alter table public.vendedores enable row level security;

create policy vendedores_select on public.vendedores
  for select to authenticated using (true);
create policy vendedores_insert on public.vendedores
  for insert to authenticated with check (true);
create policy vendedores_update on public.vendedores
  for update to authenticated using (true) with check (true);
create policy vendedores_delete on public.vendedores
  for delete to authenticated using (true);

revoke all on public.vendedores from anon, public;
grant select, insert, update, delete on public.vendedores to authenticated;

revoke all on function public.resumen_vendedores(date, date) from public, anon;
grant execute on function public.resumen_vendedores(date, date) to authenticated;
