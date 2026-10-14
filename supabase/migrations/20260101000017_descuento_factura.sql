-- ============================================================================
-- 0017 · Descuento por factura
-- Se agrega `descuento_usd` a facturas y la RPC crear_factura lo aplica sobre
-- el subtotal (total_usd = subtotal − descuento). La BD sigue siendo la única
-- que calcula el total; el cliente solo previsualiza.
-- Códigos de error: KX002 (descuento negativo o mayor al subtotal).
-- ============================================================================

-- ---- 1. Columna descuento ------------------------------------------------
alter table public.facturas
  add column descuento_usd numeric(12,2) not null default 0;

alter table public.facturas
  add constraint facturas_descuento_nonneg check (descuento_usd >= 0);

comment on column public.facturas.descuento_usd is
  'Descuento aplicado en USD sobre el subtotal. El total_usd ya lo incluye.';

-- ---- 2. crear_factura con descuento ---------------------------------------
-- La firma cambia: se elimina la versión anterior para no dejar un overload.
drop function if exists public.crear_factura(uuid, text, text, integer, jsonb);

create or replace function public.crear_factura(
  p_cliente_id     uuid,
  p_numero_factura text,
  p_condicion      text,
  p_dias_credito   integer,
  p_items          jsonb,
  p_descuento_usd  numeric
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

  -- ---- Normalizar ítems: unir productos repetidos (suma de cantidades) ---
  -- Se usa el precio de la primera aparición del producto.
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
    dias_credito, fecha_vencimiento, total_usd, descuento_usd
  )
  values (
    p_cliente_id, upper(btrim(p_numero_factura)), v_fecha_emision, p_condicion,
    coalesce(p_dias_credito, 0), v_fecha_vencimiento, v_total, v_descuento
  )
  returning id into v_factura_id;

  insert into public.factura_items (factura_id, producto_id, cantidad, precio_unitario_usd, subtotal_usd)
  select v_factura_id, producto_id, cantidad, precio, round(cantidad::numeric * precio, 2)
  from _items_norm;

  return v_factura_id;
end;
$$;

comment on function public.crear_factura(uuid, text, text, integer, jsonb, numeric) is
  'Crea una factura con ítems, aplica descuento y descuenta stock de forma atómica. Devuelve el id de la factura.';

revoke all on function public.crear_factura(uuid, text, text, integer, jsonb, numeric) from public, anon;
grant execute on function public.crear_factura(uuid, text, text, integer, jsonb, numeric) to authenticated;