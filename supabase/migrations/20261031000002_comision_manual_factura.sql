-- ============================================================================
-- 0032 · Comisión manual al crear y editar facturas
-- La comisión se sigue asignando automáticamente con el % del vendedor, pero
-- ahora se puede indicar manualmente al crear la factura y editar después.
-- Una comisión ya pagada no se puede modificar.
-- ============================================================================

-- ---- 1. Permitir que el trigger distinga comisión automática de manual ----
-- Las columnas siguen siendo NOT NULL; el DEFAULT NULL permite que el trigger
-- BEFORE INSERT complete la comisión cuando no se envía un valor explícito.
alter table public.facturas
  alter column comision_pct set default null,
  alter column comision_usd set default null;

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

  new.vendedor_id := v_vendedor_id;

  if new.comision_pct is null then
    select v.comision_pct
      into v_comision_pct
      from public.vendedores v
     where v.id = v_vendedor_id;

    new.comision_pct := coalesce(v_comision_pct, 0);
  end if;

  if new.comision_usd is null then
    new.comision_usd := round(new.total_usd * new.comision_pct / 100, 2);
  end if;

  return new;
end;
$$;

-- ---- 2. crear_factura acepta comisión manual opcional ---------------------
drop function if exists public.crear_factura(uuid, text, text, integer, jsonb, numeric, boolean, numeric);

create or replace function public.crear_factura(
  p_cliente_id      uuid,
  p_numero_factura  text,
  p_condicion       text,
  p_dias_credito    integer,
  p_items           jsonb,
  p_descuento_usd   numeric default 0,
  p_modo_manual     boolean default false,
  p_monto_manual_usd numeric default null,
  p_comision_pct    numeric default null,
  p_comision_usd    numeric default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fecha_emision     date := (now() at time zone 'America/Caracas')::date;
  v_fecha_vencimiento date;
  v_total             numeric(12,2);
  v_factura_id        uuid;
  v_item              jsonb;
  v_producto_id       uuid;
  v_cantidad          integer;
  v_precio            numeric(12,2);
  v_subtotal          numeric(12,2);
  v_nombre            text;
  v_norm              record;
  v_descuento         numeric(12,2) := round(coalesce(p_descuento_usd, 0), 2);
  v_monto_manual      numeric(12,2);
  v_comision_pct      numeric(5,2);
  v_comision_usd      numeric(12,2);
begin
  -- ---- Validaciones generales -------------------------------------------
  if p_cliente_id is null then
    raise exception 'El cliente es obligatorio' using errcode = 'KX002';
  end if;
  if not exists (select 1 from public.clientes c where c.id = p_cliente_id) then
    raise exception 'El cliente no existe' using errcode = 'KX004';
  end if;

  if p_numero_factura is null or length(btrim(p_numero_factura)) = 0 then
    raise exception 'El número de factura es obligatorio' using errcode = 'KX002';
  end if;
  if length(btrim(p_numero_factura)) > 20 then
    raise exception 'El número de factura no puede superar los 20 caracteres' using errcode = 'KX002';
  end if;

  if p_condicion is null or p_condicion not in ('contado','credito') then
    raise exception 'La condición de pago no es válida' using errcode = 'KX002';
  end if;
  if p_condicion = 'contado' and coalesce(p_dias_credito, 0) <> 0 then
    raise exception 'Para pago de contado los días de crédito deben ser 0' using errcode = 'KX002';
  end if;
  if p_condicion = 'credito' and coalesce(p_dias_credito, -1) not in (7, 15, 30) then
    raise exception 'Para pago a crédito los días deben ser 7, 15 o 30' using errcode = 'KX002';
  end if;

  if v_descuento < 0 then
    raise exception 'El descuento no puede ser negativo' using errcode = 'KX002';
  end if;

  if p_comision_pct is not null and (p_comision_pct < 0 or p_comision_pct > 100) then
    raise exception 'El porcentaje de comisión debe estar entre 0 y 100' using errcode = 'KX002';
  end if;
  if p_comision_usd is not null and p_comision_usd < 0 then
    raise exception 'El monto de comisión no puede ser negativo' using errcode = 'KX002';
  end if;
  if p_comision_pct is null and p_comision_usd is not null then
    raise exception 'Indique el porcentaje de comisión' using errcode = 'KX002';
  end if;

  v_comision_pct := case
    when p_comision_pct is null then null
    else round(p_comision_pct, 2)
  end;
  v_comision_usd := case
    when p_comision_usd is null then null
    else round(p_comision_usd, 2)
  end;

  if coalesce(p_modo_manual, false) then
    v_monto_manual := round(coalesce(p_monto_manual_usd, null), 2);
    if v_monto_manual is null then
      raise exception 'El monto de la factura es obligatorio' using errcode = 'KX002';
    end if;
    if v_monto_manual <= 0 then
      raise exception 'El monto de la factura debe ser mayor a 0' using errcode = 'KX002';
    end if;
    if v_descuento > v_monto_manual then
      raise exception 'El descuento no puede superar el monto de la factura' using errcode = 'KX002';
    end if;
    v_total := v_monto_manual - v_descuento;
    if v_total < 0 then
      v_total := 0;
    end if;

    v_fecha_vencimiento := v_fecha_emision + coalesce(p_dias_credito, 0);

    insert into public.facturas (
      cliente_id, numero_factura, fecha_emision, condicion,
      dias_credito, fecha_vencimiento, total_usd, descuento_usd,
      comision_pct, comision_usd
    )
    values (
      p_cliente_id, upper(btrim(p_numero_factura)), v_fecha_emision, p_condicion,
      coalesce(p_dias_credito, 0), v_fecha_vencimiento, v_total, v_descuento,
      v_comision_pct,
      case
        when v_comision_pct is null then null
        else round(coalesce(v_comision_usd, v_total * v_comision_pct / 100), 2)
      end
    )
    returning id into v_factura_id;

    return v_factura_id;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La factura debe tener al menos un ítem' using errcode = 'KX002';
  end if;

  -- ---- Validación de cada ítem ------------------------------------------
  for v_item in select * from jsonb_array_elements(p_items) loop
    if v_item->>'producto_id' is null
       or (v_item->>'producto_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Hay un ítem con producto inválido' using errcode = 'KX002';
    end if;
    if v_item->>'cantidad' is null or (v_item->>'cantidad') !~ '^[0-9]+$'
       or (v_item->>'cantidad')::integer < 1 then
      raise exception 'La cantidad de cada ítem debe ser un entero mayor a 0' using errcode = 'KX002';
    end if;
    if v_item->>'precio_unitario_usd' is null
       or (v_item->>'precio_unitario_usd') !~ '^[0-9]+(\.[0-9]+)?$' then
      raise exception 'El precio unitario debe ser un número mayor o igual a 0' using errcode = 'KX002';
    end if;
  end loop;

  -- ---- Normalizar ítems: unir productos repetidos ------------------------
  create temp table _items_norm (
    producto_id uuid primary key,
    cantidad    integer not null,
    precio      numeric(12,2) not null
  ) on commit drop;

  insert into _items_norm (producto_id, cantidad, precio)
  select t.producto_id,
         sum(t.cantidad)::integer,
         (array_agg(t.precio order by t.ord))[1]
  from (
    select (e.i->>'producto_id')::uuid                     as producto_id,
           (e.i->>'cantidad')::integer                      as cantidad,
           (e.i->>'precio_unitario_usd')::numeric(12,2)     as precio,
           e.ord                                            as ord
    from jsonb_array_elements(p_items) with ordinality as e(i, ord)
  ) t
  group by t.producto_id;

  -- ---- Descontar stock y calcular el subtotal ---------------------------
  v_total := 0;

  for v_norm in select producto_id, cantidad, precio from _items_norm loop
    update public.productos
       set cantidad = cantidad - v_norm.cantidad
     where id = v_norm.producto_id
       and cantidad >= v_norm.cantidad
    returning nombre into v_nombre;

    if not found then
      select p.nombre into v_nombre from public.productos p where p.id = v_norm.producto_id;
      if v_nombre is null then
        raise exception 'El producto seleccionado no existe' using errcode = 'KX005';
      end if;
      raise exception 'Stock insuficiente para el producto "%"', v_nombre using errcode = 'KX001';
    end if;

    v_subtotal := round(v_norm.cantidad::numeric * v_norm.precio, 2);
    v_total := v_total + v_subtotal;
  end loop;

  -- ---- Aplicar descuento -------------------------------------------------
  if v_descuento > v_total then
    raise exception 'El descuento no puede superar el subtotal de la factura' using errcode = 'KX002';
  end if;
  v_total := v_total - v_descuento;

  -- ---- Crear la factura y sus ítems -------------------------------------
  v_fecha_vencimiento := v_fecha_emision + coalesce(p_dias_credito, 0);

  insert into public.facturas (
    cliente_id, numero_factura, fecha_emision, condicion,
    dias_credito, fecha_vencimiento, total_usd, descuento_usd,
    comision_pct, comision_usd
  )
  values (
    p_cliente_id, upper(btrim(p_numero_factura)), v_fecha_emision, p_condicion,
    coalesce(p_dias_credito, 0), v_fecha_vencimiento, v_total, v_descuento,
    v_comision_pct,
    case
      when v_comision_pct is null then null
      else round(coalesce(v_comision_usd, v_total * v_comision_pct / 100), 2)
    end
  )
  returning id into v_factura_id;

  insert into public.factura_items (factura_id, producto_id, cantidad, precio_unitario_usd, subtotal_usd)
  select v_factura_id, producto_id, cantidad, precio, round(cantidad::numeric * precio, 2)
  from _items_norm;

  return v_factura_id;
end;
$$;

comment on function public.crear_factura(uuid, text, text, integer, jsonb, numeric, boolean, numeric, numeric, numeric) is
  'Crea factura con ítems (descontando stock) o en modo manual, con comisión opcional manual.';

revoke all on function public.crear_factura(uuid, text, text, integer, jsonb, numeric, boolean, numeric, numeric, numeric) from public, anon;
grant execute on function public.crear_factura(uuid, text, text, integer, jsonb, numeric, boolean, numeric, numeric, numeric) to authenticated;

-- ---- 3. RPC para asignar o editar la comisión de una factura -------------
create or replace function public.actualizar_comision_factura(
  p_factura_id   uuid,
  p_comision_pct numeric,
  p_comision_usd numeric
)
returns table (
  comision_pct numeric,
  comision_usd numeric
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_factura_id is null then
    raise exception 'La factura es obligatoria' using errcode = 'KX002';
  end if;

  if not exists (select 1 from public.facturas f where f.id = p_factura_id) then
    raise exception 'La factura no existe' using errcode = 'KX004';
  end if;

  if p_comision_pct is null or p_comision_pct < 0 or p_comision_pct > 100 then
    raise exception 'El porcentaje de comisión debe estar entre 0 y 100' using errcode = 'KX002';
  end if;

  if p_comision_usd is null or p_comision_usd < 0 then
    raise exception 'El monto de comisión no puede ser negativo' using errcode = 'KX002';
  end if;

  if exists (
    select 1
      from public.comisiones_vendedor c
     where c.factura_id = p_factura_id
  ) then
    raise exception 'La comisión ya fue pagada y no se puede editar' using errcode = 'KX003';
  end if;

  update public.facturas f
     set comision_pct = round(p_comision_pct, 2),
         comision_usd = round(p_comision_usd, 2)
   where f.id = p_factura_id;

  return query
  select f.comision_pct, f.comision_usd
    from public.facturas f
   where f.id = p_factura_id;
end;
$$;

comment on function public.actualizar_comision_factura(uuid, numeric, numeric) is
  'Asigna o edita la comisión de una factura mientras no haya sido pagada.';

revoke all on function public.actualizar_comision_factura(uuid, numeric, numeric) from public, anon;
grant execute on function public.actualizar_comision_factura(uuid, numeric, numeric) to authenticated;
