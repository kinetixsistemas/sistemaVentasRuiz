-- ============================================================================
-- 0007 · Configuración: tabla singleton `empresa`
-- Registro único (id = 1) con los datos globales del negocio.
-- RLS: lectura, alta y edición para `authenticated`; sin DELETE.
-- ============================================================================

create table public.empresa (
  id                 smallint primary key default 1,
  nombre_comercial   text not null,
  razon_social       text,
  rif                text,
  telefono           text,
  correo             text,
  direccion          text,
  logo_url           text,
  stock_bajo_umbral  integer not null default 5,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint empresa_id_singleton           check (id = 1),
  constraint empresa_stock_bajo_umbral_nonneg check (stock_bajo_umbral >= 0),
  constraint empresa_nombre_comercial_nonempty check (length(btrim(nombre_comercial)) > 0),
  constraint empresa_rif_formato check (
    rif is null or rif ~ '^[JVEGPC]-[0-9]{8}-[0-9]$'
  ),
  constraint empresa_correo_formato check (
    correo is null
    or (correo = lower(correo)
        and correo ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  )
);

comment on table public.empresa is 'Datos globales del negocio (fila única, id = 1).';

create trigger empresa_set_updated_at
  before update on public.empresa
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS y permisos
-- ----------------------------------------------------------------------------
alter table public.empresa enable row level security;

create policy empresa_select on public.empresa
  for select to authenticated using (true);
create policy empresa_insert on public.empresa
  for insert to authenticated with check (true);
create policy empresa_update on public.empresa
  for update to authenticated using (true) with check (true);

revoke all on public.empresa from anon, public;
grant select, insert, update on public.empresa to authenticated;

-- Fila inicial (los valores reales se editan desde la app).
insert into public.empresa (id, nombre_comercial, stock_bajo_umbral)
values (1, 'Sistemas Kinetix', 5)
on conflict (id) do nothing;
