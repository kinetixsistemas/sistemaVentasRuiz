-- ============================================================================
-- 0009 · Usuarios: tabla `perfiles` + sincronización con auth.users
-- Un perfil por usuario de Supabase Auth (1 a 1).
-- RLS: lectura para `authenticated`; cada usuario solo edita su propia fila.
-- El alta de perfiles la hace el trigger handle_new_user o el service_role.
-- ============================================================================

create table public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text,
  correo      text,
  rol         text not null default 'admin',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint perfiles_rol_valido check (rol in ('admin','vendedor'))
);

comment on table public.perfiles is 'Perfil de aplicación por usuario de Supabase Auth.';

create trigger perfiles_set_updated_at
  before update on public.perfiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Alta automática de perfil al crear un usuario en auth.users
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre, correo, rol)
  values (
    new.id,
    coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Usuario'),
    new.email,
    'admin'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rellena perfiles de usuarios ya existentes.
insert into public.perfiles (id, correo)
select id, email from auth.users
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- RLS y permisos
-- ----------------------------------------------------------------------------
alter table public.perfiles enable row level security;

create policy perfiles_select on public.perfiles
  for select to authenticated using (true);
create policy perfiles_update on public.perfiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke all on public.perfiles from anon, public;
grant select, update on public.perfiles to authenticated;
