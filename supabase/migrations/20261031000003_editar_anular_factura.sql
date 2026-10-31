-- ============================================================================
-- 0033 · Edición y anulación de facturas
-- - Edición completa (cliente, número, condición, ítems/manual, descuento y
--   comisión) mientras la comisión no haya sido pagada.
-- - El nuevo total no puede ser menor a lo ya cobrado.
-- - Anulación solo si no hay pagos ni comisión pagada: devuelve stock y
--   conserva la factura con sus datos originales.
-- - Las facturas anuladas no cuentan en cartera, ventas ni comisiones.
-- ============================================================================

-- ---- 1. Marca de anulación ------------------------------------------------
alter table public.facturas
  add column if not exists anulada_at timestamptz,
  add column if not exists anulada_motivo text;

comment on column public.facturas.anulada_at is
  'Fecha de anulación. NULL si la factura está vigente.';
comment on column public.facturas.anulada_motivo is
  'Motivo opcional registrado al anular la factura.';

-- ---- 2. RPC para editar una factura completa ------------------------------
drop function if exists public.editar_factura(uuid, uuid, text, text, integer, jsonb, numeric, boolean, numeric, numeric, numeric);

create function public.editar_factura(
  p_factura_id        uuid,
  p_cliente_id        uuid,
  p_numero_factura    text,
  p_condicion         text,
  p_dias_credito      integer,
  p_items             jsonb,
  p_descuento_usd     numeric default 0,
  p_modo_manual       boolean default false,
  p_monto_manual_usd  numeric default null,
  p_comision_pct      numeric default null,
  p_comision_usd      numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fecha_emision     date;
  v_anulada_at        timestamptz;
  v_total_pagado      numeric(12,2);
  v_vendedor_id       uuid;
  v_vendedor_pct      numeric(5,2);
  v_fecha_vencimiento date;
  v_total             numeric(12,2);
  v_item              jsonb;
  v_subtotal          numeric(12,2);
  v_nombre            text;
  v_ajuste            record;
  v_descuento         numeric(12,2) := round(coalesce(p_descuento_usd, 0), 2);
  v_monto_manual      numeric(12,2);
  v_comision_pct      numeric(5,2);
  v_comision_usd      numeric(12,2);
begin
  if p_factura_id is null then
    raise exception 'La factura es obligatoria' using errcode = 'KX002';
  end if;

  select f.fecha_emision, f.anulada_at, f.total_pagado_usd
    into v_fecha_emision, v_anulada_at, v_total_pagado
    from public.facturas f
   where f.id = p_factura_id
   for update;

  if not found then
    raise exception 'La factura no existe' using errcode = 'KX004';
  end if;
  if v_anulada_at is not null then
    raise exception 'La factura está anulada y no se puede editar' using errcode = 'KX003';
  end if;
  if exists (
    select 1 from public.comisiones_vendedor c where c.factura_id = p_factura_id
  ) then
    raise exception 'La comisión ya fue pagada y la factura no se puede editar' using errcode = 'KX003';
  end if;

  if p_cliente_id is null then
    raise exception 'El cliente es obligatorio' using errcode = 'KX002';
  end if;
  select c.vendedor_id into v_vendedor_id
    from public.clientes c
   where c.id = p_cliente_id;
  if v_vendedor_id is null then
    raise exception 'El cliente no existe o no tiene vendedor asignado' using errcode = 'KX002';
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

  drop table if exists pg_temp._items_edit_norm;
  create temp table _items_edit_norm (
    producto_id uuid primary key,
    cantidad    integer not null,
    precio      numeric(12,2) not null
  ) on commit drop;

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
  else
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
      raise exception 'La factura debe tener al menos un ítem' using errcode = 'KX002';
    end if;

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

    insert into _items_edit_norm (producto_id, cantidad, precio)
    select t.producto_id,
           sum(t.cantidad)::integer,
           (array_agg(t.precio order by t.ord))[1]
      from (
        select (e.i->>'producto_id')::uuid                 as producto_id,
               (e.i->>'cantidad')::integer                  as cantidad,
               (e.i->>'precio_unitario_usd')::numeric(12,2) as precio,
               e.ord                                        as ord
          from jsonb_array_elements(p_items) with ordinality as e(i, ord)
      ) t
     group by t.producto_id;

    select coalesce(sum(cantidad::numeric * precio), 0)
      into v_subtotal
      from _items_edit_norm;

    if v_descuento > v_subtotal then
      raise exception 'El descuento no puede superar el subtotal de la factura' using errcode = 'KX002';
    end if;
    v_total := v_subtotal - v_descuento;
  end if;

  if v_total < v_total_pagado - 0.005 then
    raise exception 'El nuevo total no puede ser menor a lo ya cobrado' using errcode = 'KX002';
  end if;

  drop table if exists pg_temp._ajustes_stock;
  create temp table _ajustes_stock (
    producto_id uuid primary key,
    delta       integer not null
  ) on commit drop;

  insert into _ajustes_stock (producto_id, delta)
  select coalesce(n.producto_id, o.producto_id),
         coalesce(n.cantidad, 0) - coalesce(o.cantidad, 0)
    from _items_edit_norm n
    full join (
      select fi.producto_id, sum(fi.cantidad)::integer as cantidad
        from public.factura_items fi
       where fi.factura_id = p_factura_id
       group by fi.producto_id
    ) o using (producto_id);

  delete from _ajustes_stock where delta = 0;

  for v_ajuste in select producto_id, delta from _ajustes_stock loop
    if v_ajuste.delta > 0 then
      update public.productos p
         set cantidad = p.cantidad - v_ajuste.delta
       where p.id = v_ajuste.producto_id
         and p.cantidad >= v_ajuste.delta
      returning p.nombre into v_nombre;

      if not found then
        select p.nombre into v_nombre
          from public.productos p
         where p.id = v_ajuste.producto_id;
        if v_nombre is null then
          raise exception 'El producto seleccionado no existe' using errcode = 'KX005';
        end if;
        raise exception 'Stock insuficiente para el producto "%"', v_nombre using errcode = 'KX001';
      end if;
    else
      update public.productos p
         set cantidad = p.cantidad + (-v_ajuste.delta)
       where p.id = v_ajuste.producto_id;
      if not found then
        raise exception 'El producto seleccionado no existe' using errcode = 'KX005';
      end if;
    end if;
  end loop;

  select v.comision_pct into v_vendedor_pct
    from public.vendedores v
   where v.id = v_vendedor_id;

  v_comision_pct := round(coalesce(p_comision_pct, v_vendedor_pct, 0), 2);
  v_comision_usd := case
    when p_comision_usd is null then round(v_total * v_comision_pct / 100, 2)
    else round(p_comision_usd, 2)
  end;

  if v_comision_usd < 0 then
    raise exception 'El monto de comisión no puede ser negativo' using errcode = 'KX002';
  end if;

  v_fecha_vencimiento := v_fecha_emision + coalesce(p_dias_credito, 0);

  update public.facturas f
     set cliente_id        = p_cliente_id,
         vendedor_id       = v_vendedor_id,
         numero_factura    = upper(btrim(p_numero_factura)),
         condicion         = p_condicion,
         dias_credito      = coalesce(p_dias_credito, 0),
         fecha_vencimiento = v_fecha_vencimiento,
         total_usd         = round(v_total, 2),
         descuento_usd     = v_descuento,
         comision_pct      = v_comision_pct,
         comision_usd      = v_comision_usd
   where f.id = p_factura_id;

  delete from public.factura_items fi where fi.factura_id = p_factura_id;

  insert into public.factura_items (factura_id, producto_id, cantidad, precio_unitario_usd, subtotal_usd)
  select p_factura_id, producto_id, cantidad, precio, round(cantidad::numeric * precio, 2)
    from _items_edit_norm;

  return p_factura_id;
end;
$$;

comment on function public.editar_factura(uuid, uuid, text, text, integer, jsonb, numeric, boolean, numeric, numeric, numeric) is
  'Edita una factura vigente, ajusta stock por diferencias y valida pagos/comisión.';

revoke all on function public.editar_factura(uuid, uuid, text, text, integer, jsonb, numeric, boolean, numeric, numeric, numeric) from public, anon;
grant execute on function public.editar_factura(uuid, uuid, text, text, integer, jsonb, numeric, boolean, numeric, numeric, numeric) to authenticated;

-- ---- 3. RPC para anular una factura --------------------------------------
create or replace function public.anular_factura(
  p_factura_id uuid,
  p_motivo     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anulada_at timestamptz;
begin
  if p_factura_id is null then
    raise exception 'La factura es obligatoria' using errcode = 'KX002';
  end if;

  select f.anulada_at into v_anulada_at
    from public.facturas f
   where f.id = p_factura_id
   for update;

  if not found then
    raise exception 'La factura no existe' using errcode = 'KX004';
  end if;
  if v_anulada_at is not null then
    raise exception 'La factura ya está anulada' using errcode = 'KX003';
  end if;
  if exists (select 1 from public.pagos p where p.factura_id = p_factura_id) then
    raise exception 'No se puede anular una factura con pagos registrados' using errcode = 'KX003';
  end if;
  if exists (select 1 from public.comisiones_vendedor c where c.factura_id = p_factura_id) then
    raise exception 'No se puede anular una factura con comisión pagada' using errcode = 'KX003';
  end if;

  update public.productos p
     set cantidad = p.cantidad + fi.cantidad
    from public.factura_items fi
   where fi.factura_id = p_factura_id
     and p.id = fi.producto_id;

  update public.facturas f
     set anulada_at     = now(),
         anulada_motivo = nullif(btrim(coalesce(p_motivo, '')), ''),
         comision_pct   = 0,
         comision_usd   = 0
   where f.id = p_factura_id;
end;
$$;

comment on function public.anular_factura(uuid, text) is
  'Anula una factura sin pagos ni comisión pagada, devolviendo el stock al inventario.';

revoke all on function public.anular_factura(uuid, text) from public, anon;
grant execute on function public.anular_factura(uuid, text) to authenticated;

-- ---- 4. Bloquear pagos/comisiones sobre facturas anuladas -----------------
create or replace function public.pagos_validar_factura_activa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.facturas f
     where f.id = new.factura_id
       and f.anulada_at is not null
  ) then
    raise exception 'La factura está anulada y no admite pagos' using errcode = 'KX003';
  end if;
  return new;
end;
$$;

drop trigger if exists pagos_validar_factura_activa on public.pagos;
create trigger pagos_validar_factura_activa
  before insert or update of factura_id on public.pagos
  for each row execute function public.pagos_validar_factura_activa();

create or replace function public.comisiones_validar_factura_activa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.facturas f
     where f.id = new.factura_id
       and f.anulada_at is not null
  ) then
    raise exception 'La factura está anulada y no admite comisión' using errcode = 'KX003';
  end if;
  return new;
end;
$$;

drop trigger if exists comisiones_validar_factura_activa on public.comisiones_vendedor;
create trigger comisiones_validar_factura_activa
  before insert or update of factura_id on public.comisiones_vendedor
  for each row execute function public.comisiones_validar_factura_activa();

-- ---- 5. Comisión editable solo en facturas vigentes ----------------------
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

  if exists (
    select 1 from public.facturas f
     where f.id = p_factura_id
       and f.anulada_at is not null
  ) then
    raise exception 'La factura está anulada y no se puede editar' using errcode = 'KX003';
  end if;

  if p_comision_pct is null or p_comision_pct < 0 or p_comision_pct > 100 then
    raise exception 'El porcentaje de comisión debe estar entre 0 y 100' using errcode = 'KX002';
  end if;

  if p_comision_usd is null or p_comision_usd < 0 then
    raise exception 'El monto de comisión no puede ser negativo' using errcode = 'KX002';
  end if;

  if exists (
    select 1 from public.comisiones_vendedor c where c.factura_id = p_factura_id
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

-- ---- 6. Vista con estado anulada -----------------------------------------
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
  case
    when f.anulada_at is not null then 0
    else round(f.total_usd - f.total_pagado_usd, 2)
  end                                                          as saldo_usd,
  case
    when f.anulada_at is not null then 'anulada'
    when f.total_usd - f.total_pagado_usd <= 0.005 then 'pagada'
    when f.fecha_vencimiento < (now() at time zone 'America/Caracas')::date then 'vencida'
    when f.fecha_vencimiento <= (now() at time zone 'America/Caracas')::date + 5 then 'por_vencer'
    else 'pendiente'
  end                                                          as estado,
  case
    when f.anulada_at is not null then 0
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
  f.comision_usd,
  f.anulada_at,
  f.anulada_motivo
from public.facturas f
join public.clientes c on c.id = f.cliente_id
join public.vendedores v on v.id = f.vendedor_id;

comment on view public.facturas_con_saldo is
  'Facturas con saldo, estado (incluye anulada), días de mora, vendedor, orden numérico y comisión.';

-- ---- 7. Cartera y ventas excluyen facturas anuladas ----------------------
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
    where f.anulada_at is null
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

create or replace function public.resumen_ventas_periodo(
  p_desde date,
  p_hasta date
)
returns jsonb
language plpgsql
security invoker
stable
set search_path = ''
as $$
declare
  v_vendido   numeric(14,2);
  v_recaudado numeric(14,2);
begin
  if p_desde is null or p_hasta is null or p_desde > p_hasta then
    raise exception 'El período indicado no es válido' using errcode = 'KX002';
  end if;

  select coalesce(sum(f.total_usd), 0) into v_vendido
  from public.facturas f
  where f.fecha_emision between p_desde and p_hasta
    and f.anulada_at is null;

  select coalesce(sum(p.monto_usd), 0) into v_recaudado
  from public.pagos p
  join public.facturas f on f.id = p.factura_id
  where p.fecha between p_desde and p_hasta
    and f.anulada_at is null;

  return jsonb_build_object(
    'total_vendido_usd', round(v_vendido, 2),
    'total_recaudado_usd', round(v_recaudado, 2)
  );
end;
$$;

-- ---- 8. Resumen de vendedores excluye facturas anuladas ------------------
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
    where f.anulada_at is null
      and (p_desde is null or f.fecha_emision >= p_desde)
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
    where f.anulada_at is null
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
    where f.anulada_at is null
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

revoke all on function public.anular_factura(uuid, text) from public, anon;
grant execute on function public.anular_factura(uuid, text) to authenticated;
