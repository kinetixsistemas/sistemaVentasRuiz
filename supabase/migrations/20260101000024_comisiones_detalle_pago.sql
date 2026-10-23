-- ============================================================================
-- 0024 · Detalle de pago para comisiones de vendedores
-- Guarda cómo se pagó la comisión (igual que pagos de facturas).
-- ============================================================================
alter table public.comisiones_vendedor
  add column if not exists fecha date not null default (now() at time zone 'America/Caracas')::date,
  add column if not exists metodo text,
  add column if not exists moneda text,
  add column if not exists monto_original numeric(14,2),
  add column if not exists tasa_cambio numeric(14,4),
  add column if not exists referencia text,
  add column if not exists correo text;

update public.comisiones_vendedor
   set metodo = 'efectivo',
       moneda = 'USD',
       monto_original = monto_usd,
       tasa_cambio = null,
       referencia = null,
       correo = null,
       fecha = coalesce(pagada_at::date, (now() at time zone 'America/Caracas')::date)
 where metodo is null;

alter table public.comisiones_vendedor
  alter column metodo set not null,
  alter column moneda set not null,
  alter column monto_original set not null;

alter table public.comisiones_vendedor
  add constraint comisiones_vendedor_metodo_valido check (metodo in ('bs','efectivo','zelle','binance')),
  add constraint comisiones_vendedor_moneda_valida check (moneda in ('VES','USD')),
  add constraint comisiones_vendedor_monto_original_positivo check (monto_original > 0),
  add constraint comisiones_vendedor_reglas_metodo check (
    (metodo = 'bs'
      and moneda = 'VES'
      and tasa_cambio is not null
      and tasa_cambio > 0
      and referencia is not null
      and length(btrim(referencia)) > 0)
    or (metodo = 'efectivo'
      and moneda = 'USD'
      and tasa_cambio is null)
    or (metodo in ('zelle','binance')
      and moneda = 'USD'
      and tasa_cambio is null
      and correo is not null
      and length(btrim(correo)) > 0
      and referencia is not null
      and length(btrim(referencia)) > 0)
  );

-- Ampliar RPC para guardar detalle de pago
create or replace function public.pagar_comision_vendedor(
  p_factura_id    uuid,
  p_comision_pct  numeric,
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
  v_monto           numeric(12,2);
  v_comision_id     uuid;
  v_pagada_at       timestamptz := now();
  v_fecha           date := coalesce(p_fecha, (now() at time zone 'America/Caracas')::date);
  v_moneda          text;
  v_tasa            numeric(14,4);
  v_monto_original  numeric(14,2);
begin
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
      raise exception 'El monto en dólares no coincide con la comisión a pagar' using errcode = 'KX003';
    end if;
  elsif p_metodo = 'efectivo' then
    v_moneda := 'USD';
    v_tasa := null;
    v_monto_original := round(p_monto, 2);
    if abs(v_monto_original - v_monto) > 0.01 then
      raise exception 'El monto en dólares no coincide con la comisión a pagar' using errcode = 'KX003';
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
      raise exception 'El monto en dólares no coincide con la comisión a pagar' using errcode = 'KX003';
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
    p_comision_pct,
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
    p_comision_pct,
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

grant execute on function public.pagar_comision_vendedor(uuid, numeric, text, numeric, numeric, text, text, date) to authenticated;
