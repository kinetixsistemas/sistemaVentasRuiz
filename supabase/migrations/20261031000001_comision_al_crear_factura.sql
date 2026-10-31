-- ============================================================================
-- 0031 · Comisión del vendedor asignada al crear la factura
-- Al emitir una factura se congela el % de comisión del vendedor y el monto
-- calculado sobre el total. La comisión queda pendiente hasta que se registre
-- su pago (solo cuando la factura esté totalmente cobrada).
-- Cambiar el % del vendedor no altera facturas ya emitidas.
-- ============================================================================

-- ---- 1. Comisión asignada en la factura ----------------------------------
alter table public.facturas
  add column if not exists comision_pct numeric(5,2) not null default 0,
  add column if not exists comision_usd numeric(12,2) not null default 0;

alter table public.facturas
  drop constraint if exists facturas_comision_pct_check,
  drop constraint if exists facturas_comision_usd_check;

alter table public.facturas
  add constraint facturas_comision_pct_check check (comision_pct between 0 and 100),
  add constraint facturas_comision_usd_check check (comision_usd >= 0);

comment on column public.facturas.comision_pct is
  'Porcentaje de comisión del vendedor congelado al emitir la factura.';
comment on column public.facturas.comision_usd is
  'Monto de comisión asignado al emitir la factura.';

-- ---- 2. Snapshot de la comisión al insertar la factura -------------------
create or replace function public.facturas_set_vendedor_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_vendedor_id uuid;
  v_comision_pct numeric(5,2);
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

  select v.comision_pct
    into v_comision_pct
    from public.vendedores v
   where v.id = v_vendedor_id;

  new.vendedor_id := v_vendedor_id;
  new.comision_pct := coalesce(v_comision_pct, 0);
  new.comision_usd := round(new.total_usd * coalesce(v_comision_pct, 0) / 100, 2);

  return new;
end;
$$;

-- Histórico: se asigna con el % actual del vendedor (no hay forma de recuperar
-- el % vigente al momento de emitir cada factura).
update public.facturas f
   set comision_pct = v.comision_pct,
       comision_usd = round(f.total_usd * v.comision_pct / 100, 2)
  from public.vendedores v
 where v.id = f.vendedor_id;

-- ---- 3. Vista con la comisión asignada -----------------------------------
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
  f.vendedor_id,
  coalesce(
    nullif(regexp_replace(f.numero_factura, '[^0-9]', '', 'g'), ''),
    '0'
  )::numeric                                                    as numero_orden,
  f.comision_pct,
  f.comision_usd
from public.facturas f
join public.clientes c on c.id = f.cliente_id
join public.vendedores v on v.id = f.vendedor_id;

comment on view public.facturas_con_saldo is
  'Facturas con total pagado, saldo, estado, días de mora, vendedor, orden numérico y comisión asignada.';

-- ---- 4. RPC de pago: usa la comisión asignada, no un % manual ------------
drop function if exists public.pagar_comision_vendedor(uuid, numeric);
drop function if exists public.pagar_comision_vendedor(uuid, numeric, text, numeric, numeric, text, text, date);

create function public.pagar_comision_vendedor(
  p_factura_id    uuid,
  p_metodo        text,
  p_monto         numeric,
  p_tasa          numeric default null,
  p_referencia    text    default null,
  p_correo        text    default null,
  p_fecha         date    default null
)
returns table (
  comision_id     uuid,
  factura_id      uuid,
  vendedor_id     uuid,
  base_usd        numeric,
  comision_pct    numeric,
  monto_usd       numeric,
  pagada_at       timestamptz,
  fecha           date,
  metodo          text,
  moneda          text,
  monto_original  numeric,
  tasa_cambio     numeric,
  referencia      text,
  correo          text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vendedor_id     uuid;
  v_total           numeric(12,2);
  v_pagado          numeric(12,2);
  v_comision_pct    numeric(5,2);
  v_monto           numeric(12,2);
  v_comision_id     uuid;
  v_pagada_at       timestamptz := now();
  v_fecha           date := coalesce(p_fecha, (now() at time zone 'America/Caracas')::date);
  v_moneda          text;
  v_tasa            numeric(14,4);
  v_monto_original  numeric(14,2);
begin
  perform pg_advisory_xact_lock(hashtextextended(p_factura_id::text, 0));

  select f.vendedor_id, f.total_usd, f.total_pagado_usd, f.comision_pct, f.comision_usd
    into v_vendedor_id, v_total, v_pagado, v_comision_pct, v_monto
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

  if v_comision_pct is null or v_comision_pct <= 0 or v_monto is null or v_monto <= 0 then
    raise exception 'La factura no tiene una comisión asignada' using errcode = 'KX003';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto del pago debe ser mayor a 0' using errcode = 'KX003';
  end if;

  if p_metodo = 'bs' then
    if p_tasa is null or p_tasa <= 0 then
      raise exception 'La tasa de cambio debe ser mayor a 0' using errcode = 'KX003';
    end if;
    if p_referencia is null or length(btrim(p_referencia)) = 0 then
      raise exception 'La referencia es obligatoria para pagos en bolívares' using errcode = 'KX003';
    end if;
    v_moneda := 'VES';
    v_tasa := round(p_tasa, 4);
    v_monto_original := round(p_monto, 2);
    if abs(round(v_monto_original / v_tasa, 2) - v_monto) > 0.01 then
      raise exception 'El monto en dólares no coincide con la comisión asignada' using errcode = 'KX003';
    end if;
  elsif p_metodo = 'efectivo' then
    v_moneda := 'USD';
    v_tasa := null;
    v_monto_original := round(p_monto, 2);
    if abs(v_monto_original - v_monto) > 0.01 then
      raise exception 'El monto en dólares no coincide con la comisión asignada' using errcode = 'KX003';
    end if;
  elsif p_metodo in ('zelle', 'binance') then
    if p_correo is null or length(btrim(p_correo)) = 0 then
      raise exception 'El correo es obligatorio para este método de pago' using errcode = 'KX003';
    end if;
    if p_referencia is null or length(btrim(p_referencia)) = 0 then
      raise exception 'La referencia es obligatoria para este método de pago' using errcode = 'KX003';
    end if;
    v_moneda := 'USD';
    v_tasa := null;
    v_monto_original := round(p_monto, 2);
    if abs(v_monto_original - v_monto) > 0.01 then
      raise exception 'El monto en dólares no coincide con la comisión asignada' using errcode = 'KX003';
    end if;
  else
    raise exception 'El método de pago no es válido' using errcode = 'KX003';
  end if;

  insert into public.comisiones_vendedor (
    factura_id,
    vendedor_id,
    base_usd,
    comision_pct,
    monto_usd,
    pagada_at,
    fecha,
    metodo,
    moneda,
    monto_original,
    tasa_cambio,
    referencia,
    correo
  )
  values (
    p_factura_id,
    v_vendedor_id,
    v_total,
    v_comision_pct,
    v_monto,
    v_pagada_at,
    v_fecha,
    p_metodo,
    v_moneda,
    v_monto_original,
    v_tasa,
    nullif(btrim(coalesce(p_referencia, '')), ''),
    nullif(btrim(coalesce(p_correo, '')), '')
  )
  returning id into v_comision_id;

  return query
  select
    v_comision_id,
    p_factura_id,
    v_vendedor_id,
    v_total,
    v_comision_pct,
    v_monto,
    v_pagada_at,
    v_fecha,
    p_metodo,
    v_moneda,
    v_monto_original,
    v_tasa,
    nullif(btrim(coalesce(p_referencia, '')), ''),
    nullif(btrim(coalesce(p_correo, '')), '');
end;
$$;

comment on function public.pagar_comision_vendedor(uuid, text, numeric, numeric, text, text, date) is
  'Registra el pago de la comisión asignada a una factura totalmente cobrada.';

revoke all on function public.pagar_comision_vendedor(uuid, text, numeric, numeric, text, text, date) from public, anon;
grant execute on function public.pagar_comision_vendedor(uuid, text, numeric, numeric, text, text, date) to authenticated;

-- ---- 5. Resumen: pendiente = comisiones asignadas aún no pagadas ---------
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
      coalesce(sum(f.comision_usd), 0)::numeric(12,2) as monto
    from public.facturas f
    left join public.comisiones_vendedor c on c.factura_id = f.id
    where c.id is null
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
    round(coalesce(com.pagado, 0) + coalesce(pend.monto, 0), 2),
    coalesce(com.pagado, 0),
    coalesce(pend.monto, 0),
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
  'Métricas de facturación por período y comisiones asignadas/pagadas por vendedor.';

revoke all on function public.resumen_vendedores(date, date) from public, anon;
grant execute on function public.resumen_vendedores(date, date) to authenticated;
