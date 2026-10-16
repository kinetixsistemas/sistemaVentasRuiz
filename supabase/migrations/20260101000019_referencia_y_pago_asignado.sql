-- ============================================================================
-- 0019 · Referencia duplicada y pago asignado a varias facturas
--
-- 1. `normalizar_referencia(text)`: clave de control de una referencia.
--    Toma los últimos 6 dígitos y rellena con ceros a la izquierda si hay
--    menos (Ej. "1234" -> "001234", "8901234567" -> "234567"). Devuelve null
--    si la referencia no tiene ningún dígito (no se puede comparar).
--
-- 2. `registrar_pago` rechaza un pago si ya existe otro con la misma clave de
--    referencia para el mismo método (bs, zelle o binance). La verificación se
--    hace dentro de la transacción con un lock de asesoría, por lo que un mismo
--    pago repartido en varias facturas (misma referencia, varias filas) es
--    válido: se revisa una sola vez, antes de insertar.
--
-- 3. `registrar_pago_asignado(...)`: registra un pago repartido entre varias
--    facturas de un mismo cliente. Los montos se expresan en USD (moneda base);
--    para pagos en Bs se deriva el monto original por fila con la tasa.
--
-- Códigos de error propios (SQLSTATE):
--   KX003 pago inválido / sobrepago / referencia duplicada
--   KX004 factura inexistente
-- ============================================================================

-- ---- 1. Clave de referencia (últimos 6 dígitos) ----------------------------
create or replace function public.normalizar_referencia(p_ref text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_ref is null then null
    when regexp_replace(btrim(p_ref), '\D', '', 'g') = '' then null
    else lpad(right(regexp_replace(btrim(p_ref), '\D', '', 'g'), 6), 6, '0')
  end;
$$;

comment on function public.normalizar_referencia(text) is
  'Clave de referencia: últimos 6 dígitos, rellenados con 0 a la izquierda. Null si no hay dígitos.';

-- Índice de apoyo para la verificación de duplicados (no único: un pago
-- repartido puede compartir la misma referencia en varias filas).
create index pagos_referencia_norm_idx
  on public.pagos (metodo, public.normalizar_referencia(referencia))
  where referencia is not null;

-- ---- 2. registrar_pago con control de referencia duplicada -----------------
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
  v_ref_norm        text;
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

  -- ---- Evitar referencias duplicadas (por método, últimos 6 dígitos) ----
  v_ref_norm := public.normalizar_referencia(p_referencia);
  if v_ref_norm is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_metodo || ':' || v_ref_norm, 0));
    if exists (
      select 1 from public.pagos
      where metodo = p_metodo
        and public.normalizar_referencia(referencia) = v_ref_norm
    ) then
      raise exception 'Ya existe un pago con una referencia que termina en %', v_ref_norm
        using errcode = 'KX003';
    end if;
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
  'Registra un pago (total o parcial), rechaza referencias duplicadas y devuelve el monto en USD y el nuevo saldo.';

revoke all on function public.registrar_pago(uuid, text, numeric, numeric, text, text, date) from public;
grant execute on function public.registrar_pago(uuid, text, numeric, numeric, text, text, date) to authenticated;

-- ---- 3. registrar_pago_asignado: un pago repartido en varias facturas ------
create or replace function public.registrar_pago_asignado(
  p_metodo       text,
  p_tasa         numeric,
  p_referencia   text,
  p_correo       text,
  p_fecha        date,
  p_asignaciones jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fecha         date := coalesce(p_fecha, (now() at time zone 'America/Caracas')::date);
  v_moneda        text;
  v_tasa          numeric(14,4);
  v_ref_norm      text;
  v_cliente_id    uuid;
  v_item          jsonb;
  v_factura_id    uuid;
  v_monto_usd     numeric(12,2);
  v_monto_orig    numeric(14,2);
  v_total         numeric(12,2);
  v_pagado        numeric(12,2);
  v_saldo         numeric(12,2);
  v_pago_id       uuid;
  v_nuevo_saldo   numeric(12,2);
  v_result        jsonb := '[]'::jsonb;
  v_total_usd     numeric(12,2) := 0;
  v_count         integer;
  v_count_dist    integer;
begin
  -- ---- Validar la lista de asignaciones ---------------------------------
  if p_asignaciones is null
     or jsonb_typeof(p_asignaciones) <> 'array'
     or jsonb_array_length(p_asignaciones) = 0 then
    raise exception 'Debe indicar al menos una factura para el pago' using errcode = 'KX003';
  end if;

  -- ---- Validar método ---------------------------------------------------
  if p_metodo = 'bs' then
    if p_tasa is null or p_tasa <= 0 then
      raise exception 'La tasa de cambio debe ser mayor a 0' using errcode = 'KX003';
    end if;
    if p_referencia is null or length(btrim(p_referencia)) = 0 then
      raise exception 'La referencia es obligatoria para pagos en bolívares' using errcode = 'KX003';
    end if;
    v_moneda := 'VES';
    v_tasa := round(p_tasa, 4);

  elsif p_metodo = 'efectivo' then
    v_moneda := 'USD';
    v_tasa := null;

  elsif p_metodo in ('zelle', 'binance') then
    if p_correo is null or length(btrim(p_correo)) = 0 then
      raise exception 'El correo es obligatorio para este método de pago' using errcode = 'KX003';
    end if;
    if p_referencia is null or length(btrim(p_referencia)) = 0 then
      raise exception 'La referencia es obligatoria para este método de pago' using errcode = 'KX003';
    end if;
    v_moneda := 'USD';
    v_tasa := null;

  else
    raise exception 'El método de pago no es válido' using errcode = 'KX003';
  end if;

  -- ---- Validar cada asignación ------------------------------------------
  for v_item in select * from jsonb_array_elements(p_asignaciones) loop
    if v_item->>'factura_id' is null
       or (v_item->>'factura_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Hay una asignación con factura inválida' using errcode = 'KX003';
    end if;
    if v_item->>'monto_usd' is null
       or (v_item->>'monto_usd') !~ '^[0-9]+(\.[0-9]+)?$'
       or (v_item->>'monto_usd')::numeric <= 0 then
      raise exception 'Cada asignación debe tener un monto en dólares mayor a 0' using errcode = 'KX003';
    end if;
  end loop;

  select count(*), count(distinct (e.i->>'factura_id'))
    into v_count, v_count_dist
  from jsonb_array_elements(p_asignaciones) e(i);

  if v_count <> v_count_dist then
    raise exception 'No se puede asignar el mismo pago dos veces a la misma factura' using errcode = 'KX003';
  end if;

  -- ---- Todas las facturas deben ser del mismo cliente -------------------
  select f.cliente_id into v_cliente_id
  from public.facturas f
  where f.id = ((p_asignaciones->0->>'factura_id')::uuid);

  if not found then
    raise exception 'La factura no existe' using errcode = 'KX004';
  end if;

  -- Bloquear facturas en orden estable (evita deadlocks entre llamadas).
  for v_factura_id in
    select distinct (e.i->>'factura_id')::uuid
    from jsonb_array_elements(p_asignaciones) e(i)
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_factura_id::text, 0));
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_asignaciones) e(i)
    join public.facturas f on f.id = (e.i->>'factura_id')::uuid
    where f.cliente_id <> v_cliente_id
  ) then
    raise exception 'Todas las facturas deben pertenecer al mismo cliente' using errcode = 'KX003';
  end if;

  -- ---- Evitar referencias duplicadas (una sola vez para todo el pago) ---
  v_ref_norm := public.normalizar_referencia(p_referencia);
  if v_ref_norm is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_metodo || ':' || v_ref_norm, 0));
    if exists (
      select 1 from public.pagos
      where metodo = p_metodo
        and public.normalizar_referencia(referencia) = v_ref_norm
    ) then
      raise exception 'Ya existe un pago con una referencia que termina en %', v_ref_norm
        using errcode = 'KX003';
    end if;
  end if;

  -- ---- Insertar una fila de pago por factura ----------------------------
  for v_item in select * from jsonb_array_elements(p_asignaciones) loop
    v_factura_id := (v_item->>'factura_id')::uuid;
    v_monto_usd := round((v_item->>'monto_usd')::numeric, 2);

    select total_usd into v_total
    from public.facturas
    where id = v_factura_id;

    select coalesce(sum(monto_usd), 0) into v_pagado
    from public.pagos
    where factura_id = v_factura_id;

    v_saldo := round(v_total - v_pagado, 2);

    if v_saldo <= 0.005 then
      raise exception 'Una de las facturas ya está pagada en su totalidad' using errcode = 'KX003';
    end if;

    if v_monto_usd > v_saldo then
      if v_monto_usd - v_saldo <= 0.01 then
        v_monto_usd := v_saldo;
      else
        raise exception 'El monto asignado (%) supera el saldo pendiente (%)', v_monto_usd, v_saldo
          using errcode = 'KX003';
      end if;
    end if;

    if p_metodo = 'bs' then
      v_monto_orig := round(v_monto_usd * v_tasa, 2);
      v_monto_usd := round(v_monto_orig / v_tasa, 2);
    else
      v_monto_orig := v_monto_usd;
    end if;

    if v_monto_orig <= 0 or v_monto_usd <= 0 then
      raise exception 'El monto del pago debe ser mayor a 0' using errcode = 'KX003';
    end if;

    insert into public.pagos (
      factura_id, fecha, metodo, monto_original, moneda, tasa_cambio, monto_usd, referencia, correo
    )
    values (
      v_factura_id, v_fecha, p_metodo, v_monto_orig, v_moneda, v_tasa, v_monto_usd,
      nullif(btrim(coalesce(p_referencia, '')), ''),
      nullif(btrim(coalesce(p_correo, '')), '')
    )
    returning id into v_pago_id;

    v_nuevo_saldo := greatest(round(v_saldo - v_monto_usd, 2), 0);
    v_total_usd := round(v_total_usd + v_monto_usd, 2);

    v_result := v_result || jsonb_build_object(
      'pago_id',    v_pago_id,
      'factura_id', v_factura_id,
      'monto_usd',  v_monto_usd,
      'saldo_usd',  v_nuevo_saldo,
      'estado',     case when v_nuevo_saldo <= 0.005 then 'pagada' else 'pendiente' end
    );
  end loop;

  return jsonb_build_object('total_usd', v_total_usd, 'pagos', v_result);
end;
$$;

comment on function public.registrar_pago_asignado(text, numeric, text, text, date, jsonb) is
  'Registra un pago repartido entre varias facturas de un mismo cliente. Los montos van en USD.';

revoke all on function public.registrar_pago_asignado(text, numeric, text, text, date, jsonb) from public;
grant execute on function public.registrar_pago_asignado(text, numeric, text, text, date, jsonb) to authenticated;
