-- ============================================================================
-- 0020 · Categorías de inventario
-- Categorías independientes de los productos para poder crearlas y reutilizarlas.
-- Un producto puede no tener categoría (on delete set null).
-- ============================================================================

create table public.categorias (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  created_at  timestamptz not null default now(),

  constraint categorias_nombre_nonempty check (length(btrim(nombre)) > 0)
);

-- Evita duplicados sin distinguir mayúsculas/minúsculas.
create unique index categorias_nombre_lower_key on public.categorias (lower(nombre));

comment on table public.categorias is 'Categorías reutilizables del inventario.';

insert into public.categorias (nombre)
values
  ('Tripas'),
  ('Cascos'),
  ('Maleteros'),
  ('Cauchos'),
  ('Rodamientos'),
  ('Bujías'),
  ('Repuestos')
on conflict do nothing;

alter table public.productos
  add column categoria_id uuid references public.categorias(id) on delete set null;

create index productos_categoria_id_idx on public.productos (categoria_id);

-- ----------------------------------------------------------------------------
-- RLS y permisos: lectura y alta para usuarios autenticados.
-- ----------------------------------------------------------------------------
alter table public.categorias enable row level security;

create policy categorias_select on public.categorias
  for select to authenticated using (true);
create policy categorias_insert on public.categorias
  for insert to authenticated with check (true);

revoke all on public.categorias from anon, public;
grant select, insert on public.categorias to authenticated;
