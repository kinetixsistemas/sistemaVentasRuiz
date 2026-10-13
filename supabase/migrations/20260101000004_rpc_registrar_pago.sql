-- ============================================================================
-- 0004 · RPC registrar_pago
-- Bloquea la factura (FOR UPDATE) para evitar sobrepagos concurrentes.
-- Convierte Bs → USD con la tasa recibida y rechaza sobrepagos.
-- SECURITY INVOKER → aplica RLS del usuario autenticado.
-- Códigos de error propios (SQLSTATE):
--   KX003 pago inválido / sobrepago / factura ya pagada
--   KX004 factura inexistente
-- ============================================================================

create or replace function public.registrar_pago(
  p_factura_id uuid,
  p_metodo     text,
  p_monto      numeric,
  p_tasa       numeric,
  p_referencia text,
  p_correo     text,
  p_fecha      date
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total           numeric(12,2);
  v_pagado          numeric(12,2);
  v_saldo           numeric(12,2);
  v_moneda          text;
  v_tasa            numeric(14,4);
  v_monto_original  numeric(14,2);
  v_monto_usd       numeric(12,2);
  v_fecha           date := coalesce(p_fecha, (now() at time zone 'America/Caracas')::date);
  v_pago_id         uuid;
  v_nuevo_saldo     numeric(12,2);
begin
  -- ---- Serializar pagos concurrentes sobre la misma factura --------------
  -- Las facturas son inmutables (no se otorga UPDATE ni política de UPDATE),
  -- por lo que SELECT ... FOR UPDATE devolvería 0 filas bajo RLS.
  -- Se usa un lock de asesoría por transacción, liberado al terminar la RPC.
  perform pg_advisory_xact_lock(hashtextextended(p_factura_id::text, 0));

  select total_usd into v_total
  from public.facturas
  where id = p_factura_id;

  if not found then
    raise exception 'La factura no existe' using errcode = 'KX004';
  end if;

  select coalesce(sum(monto_usd), 0) into v_pagado
  from public.pagos
  where factura_id = p_factura_id;

  v_saldo := round(v_total - v_pagado, 2);

  if v_saldo <= 0.005 then
    raise exception 'La factura ya está pagada en su totalidad' using errcode = 'KX003';
  end if;

  -- ---- Validar método y calcular el monto en USD ------------------------
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
    v_monto_usd := round(v_monto_original / v_tasa, 2);

  elsif p_metodo = 'efectivo' then
    v_moneda := 'USD';
    v_tasa := null;
    v_monto_original := round(p_monto, 2);
    v_monto_usd := v_monto_original;

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
    v_monto_usd := v_monto_original;

  else
    raise exception 'El método de pago no es válido' using errcode = 'KX003';
  end if;

  if v_monto_usd <= 0 then
    raise exception 'El monto en dólares debe ser mayor a 0' using errcode = 'KX003';
  end if;

  -- ---- Rechazar sobrepagos (con tolerancia de 0.01 USD) -----------------
  if v_monto_usd > v_saldo then
    if v_monto_usd - v_saldo <= 0.01 then
      -- Ajustar el pago al saldo exacto
      if p_metodo = 'bs' then
        v_monto_original := round(v_saldo * v_tasa, 2);
        v_monto_usd := round(v_monto_original / v_tasa, 2);
      else
        v_monto_original := v_saldo;
        v_monto_usd := v_saldo;
      end if;
    else
      raise exception 'El pago (%) supera el saldo pendiente (%)', v_monto_usd, v_saldo
        using errcode = 'KX003';
    end if;
  end if;

  if v_monto_usd > v_saldo then
    v_monto_usd := v_saldo;
  end if;

  -- ---- Registrar el pago ------------------------------------------------
  insert into public.pagos (
    factura_id, fecha, metodo, monto_original, moneda, tasa_cambio, monto_usd, referencia, correo
  )
  values (
    p_factura_id, v_fecha, p_metodo, v_monto_original, v_moneda, v_tasa, v_monto_usd,
    nullif(btrim(coalesce(p_referencia, '')), ''),
    nullif(btrim(coalesce(p_correo, '')), '')
  )
  returning id into v_pago_id;

  v_nuevo_saldo := greatest(round(v_saldo - v_monto_usd, 2), 0);

  return jsonb_build_object(
    'pago_id',    v_pago_id,
    'factura_id', p_factura_id,
    'monto_usd',  v_monto_usd,
    'saldo_usd',  v_nuevo_saldo,
    'estado',     case when v_nuevo_saldo <= 0.005 then 'pagada' else 'pendiente' end
  );
end;
$$;

comment on function public.registrar_pago(uuid, text, numeric, numeric, text, text, date) is
  'Registra un pago (total o parcial) y devuelve el monto en USD y el nuevo saldo.';

revoke all on function public.registrar_pago(uuid, text, numeric, numeric, text, text, date) from public;
grant execute on function public.registrar_pago(uuid, text, numeric, numeric, text, text, date) to authenticated;
