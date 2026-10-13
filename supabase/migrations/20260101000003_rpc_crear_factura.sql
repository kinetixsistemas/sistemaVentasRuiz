-- ============================================================================
-- 0003 · RPC crear_factura
-- Inserta factura + ítems y descuenta stock en UNA sola transacción.
-- El total SIEMPRE lo calcula el servidor (nunca se confía en el total del cliente).
-- SECURITY INVOKER → aplica RLS del usuario autenticado.
-- Códigos de error propios (SQLSTATE) para mapearlos en lib/result.ts:
--   KX001 stock insuficiente
--   KX002 datos de factura inválidos
--   KX004 cliente inexistente
--   KX005 producto inexistente
-- ============================================================================

create or replace function public.crear_factura(
  p_cliente_id     uuid,
  p_numero_factura text,
  p_condicion      text,
  p_dias_credito   integer,
  p_items          jsonb
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

  -- ---- Descontar stock y calcular el total ------------------------------
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

  -- ---- Crear la factura y sus ítems -------------------------------------
  v_fecha_vencimiento := v_fecha_emision + coalesce(p_dias_credito, 0);

  insert into public.facturas (
    cliente_id, numero_factura, fecha_emision, condicion,
    dias_credito, fecha_vencimiento, total_usd
  )
  values (
    p_cliente_id, upper(btrim(p_numero_factura)), v_fecha_emision, p_condicion,
    coalesce(p_dias_credito, 0), v_fecha_vencimiento, v_total
  )
  returning id into v_factura_id;

  insert into public.factura_items (factura_id, producto_id, cantidad, precio_unitario_usd, subtotal_usd)
  select v_factura_id, producto_id, cantidad, precio, round(cantidad::numeric * precio, 2)
  from _items_norm;

  return v_factura_id;
end;
$$;

comment on function public.crear_factura(uuid, text, text, integer, jsonb) is
  'Crea una factura con ítems y descuenta stock de forma atómica. Devuelve el id de la factura.';

revoke all on function public.crear_factura(uuid, text, text, integer, jsonb) from public;
grant execute on function public.crear_factura(uuid, text, text, integer, jsonb) to authenticated;
