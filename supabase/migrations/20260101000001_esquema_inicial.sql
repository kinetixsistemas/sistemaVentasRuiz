-- ============================================================================
-- 0001 · Esquema inicial: productos, clientes, facturas, factura_items, pagos
-- Zona horaria de referencia: America/Caracas.
-- Todas las claves foráneas usan ON DELETE RESTRICT (nada se borra en cascada).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Función reutilizable para actualizar updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- productos
-- ----------------------------------------------------------------------------
create table public.productos (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  nombre      text not null,
  cantidad    integer not null default 0,
  precio_usd  numeric(12,2) not null default 0,
  foto_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint productos_cantidad_nonneg check (cantidad >= 0),
  constraint productos_precio_nonneg   check (precio_usd >= 0),
  constraint productos_codigo_formato  check (
    length(btrim(codigo)) > 0
    and codigo = upper(codigo)
    and codigo !~ '[[:space:]]'
  ),
  constraint productos_nombre_nonempty check (length(btrim(nombre)) > 0)
);

comment on column public.productos.codigo is 'Código único, normalizado en mayúsculas y sin espacios.';

-- ----------------------------------------------------------------------------
-- clientes
-- ----------------------------------------------------------------------------
create table public.clientes (
  id                uuid primary key default gen_random_uuid(),
  rif               text not null unique,
  nombre_juridico   text not null,
  nombre_encargado  text not null,
  telefono          text not null,
  correo            text not null,
  direccion         text not null,
  vendedor          text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint clientes_rif_formato     check (rif ~ '^[JVEGPC]-[0-9]{8}-[0-9]$'),
  constraint clientes_telefono_digitos check (telefono ~ '^[0-9]{10,13}$'),
  constraint clientes_correo_formato  check (correo = lower(correo) and correo ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint clientes_nombre_juridico_nonempty check (length(btrim(nombre_juridico)) > 0),
  constraint clientes_encargado_nonempty       check (length(btrim(nombre_encargado)) > 0),
  constraint clientes_vendedor_nonempty        check (length(btrim(vendedor)) > 0),
  constraint clientes_direccion_nonempty       check (length(btrim(direccion)) > 0)
);

-- ----------------------------------------------------------------------------
-- facturas
-- ----------------------------------------------------------------------------
create table public.facturas (
  id                 uuid primary key default gen_random_uuid(),
  cliente_id         uuid not null references public.clientes(id) on delete restrict,
  numero_factura     text not null unique,
  fecha_emision      date not null default (now() at time zone 'America/Caracas')::date,
  condicion          text not null,
  dias_credito       integer not null,
  fecha_vencimiento  date not null,
  total_usd          numeric(12,2) not null,
  created_at         timestamptz not null default now(),

  constraint facturas_condicion_valida check (condicion in ('contado','credito')),
  constraint facturas_condicion_dias_check check (
    (condicion = 'contado' and dias_credito = 0)
    or (condicion = 'credito' and dias_credito in (7,15,30))
  ),
  constraint facturas_vencimiento_check check (fecha_vencimiento = fecha_emision + dias_credito),
  constraint facturas_total_nonneg check (total_usd >= 0),
  constraint facturas_numero_nonempty check (length(btrim(numero_factura)) > 0)
);

-- ----------------------------------------------------------------------------
-- factura_items
-- ----------------------------------------------------------------------------
create table public.factura_items (
  id                   uuid primary key default gen_random_uuid(),
  factura_id           uuid not null references public.facturas(id) on delete restrict,
  producto_id          uuid not null references public.productos(id) on delete restrict,
  cantidad             integer not null,
  precio_unitario_usd  numeric(12,2) not null,
  subtotal_usd         numeric(12,2) not null,

  constraint factura_items_cantidad_positiva check (cantidad > 0),
  constraint factura_items_precio_nonneg      check (precio_unitario_usd >= 0),
  constraint factura_items_subtotal_nonneg    check (subtotal_usd >= 0),
  constraint factura_items_subtotal_coherente check (
    subtotal_usd = round(cantidad::numeric * precio_unitario_usd, 2)
  ),
  constraint factura_items_producto_unico unique (factura_id, producto_id)
);

-- ----------------------------------------------------------------------------
-- pagos
-- ----------------------------------------------------------------------------
create table public.pagos (
  id              uuid primary key default gen_random_uuid(),
  factura_id      uuid not null references public.facturas(id) on delete restrict,
  fecha           date not null default (now() at time zone 'America/Caracas')::date,
  metodo          text not null,
  monto_original  numeric(14,2) not null,
  moneda          text not null,
  tasa_cambio     numeric(14,4),
  monto_usd       numeric(12,2) not null,
  referencia      text,
  correo          text,
  created_at      timestamptz not null default now(),

  constraint pagos_metodo_valido check (metodo in ('bs','efectivo','zelle','binance')),
  constraint pagos_moneda_valida check (moneda in ('VES','USD')),
  constraint pagos_monto_positivo check (monto_original > 0),
  constraint pagos_monto_usd_positivo check (monto_usd > 0),

  -- Reglas por método de pago
  constraint pagos_reglas_metodo check (
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
  ),

  -- Coherencia entre monto original y monto en USD
  constraint pagos_conversion_coherente check (
    (metodo = 'bs' and monto_usd = round(monto_original / tasa_cambio, 2))
    or (metodo <> 'bs' and monto_usd = monto_original)
  )
);

-- ----------------------------------------------------------------------------
-- Índices en llaves foráneas y columnas de consulta frecuente
-- ----------------------------------------------------------------------------
create index facturas_cliente_id_idx          on public.facturas (cliente_id);
create index facturas_fecha_vencimiento_idx   on public.facturas (fecha_vencimiento);
create index factura_items_factura_id_idx     on public.factura_items (factura_id);
create index factura_items_producto_id_idx    on public.factura_items (producto_id);
create index pagos_factura_id_idx             on public.pagos (factura_id);

-- ----------------------------------------------------------------------------
-- Triggers updated_at
-- ----------------------------------------------------------------------------
create trigger productos_set_updated_at
  before update on public.productos
  for each row execute function public.set_updated_at();

create trigger clientes_set_updated_at
  before update on public.clientes
  for each row execute function public.set_updated_at();
