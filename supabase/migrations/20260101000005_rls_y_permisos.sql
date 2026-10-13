-- ============================================================================
-- 0005 · RLS y permisos
-- Regla del MVP: facturas, factura_items y pagos son INMUTABLES.
--   → No existen políticas de UPDATE ni DELETE para esas tablas.
-- Todo el acceso es exclusivamente para el rol `authenticated`.
-- ============================================================================

-- ---- Activar RLS en todas las tablas --------------------------------------
alter table public.productos     enable row level security;
alter table public.clientes      enable row level security;
alter table public.facturas      enable row level security;
alter table public.factura_items enable row level security;
alter table public.pagos         enable row level security;

-- ----------------------------------------------------------------------------
-- productos: CRUD completo
-- ----------------------------------------------------------------------------
create policy productos_select on public.productos
  for select to authenticated using (true);
create policy productos_insert on public.productos
  for insert to authenticated with check (true);
create policy productos_update on public.productos
  for update to authenticated using (true) with check (true);
create policy productos_delete on public.productos
  for delete to authenticated using (true);

-- ----------------------------------------------------------------------------
-- clientes: CRUD completo
-- ----------------------------------------------------------------------------
create policy clientes_select on public.clientes
  for select to authenticated using (true);
create policy clientes_insert on public.clientes
  for insert to authenticated with check (true);
create policy clientes_update on public.clientes
  for update to authenticated using (true) with check (true);
create policy clientes_delete on public.clientes
  for delete to authenticated using (true);

-- ----------------------------------------------------------------------------
-- facturas: solo lectura e inserción (inmutable)
-- ----------------------------------------------------------------------------
create policy facturas_select on public.facturas
  for select to authenticated using (true);
create policy facturas_insert on public.facturas
  for insert to authenticated with check (true);

-- ----------------------------------------------------------------------------
-- factura_items: solo lectura e inserción (inmutable)
-- ----------------------------------------------------------------------------
create policy factura_items_select on public.factura_items
  for select to authenticated using (true);
create policy factura_items_insert on public.factura_items
  for insert to authenticated with check (true);

-- ----------------------------------------------------------------------------
-- pagos: solo lectura e inserción (inmutable)
-- ----------------------------------------------------------------------------
create policy pagos_select on public.pagos
  for select to authenticated using (true);
create policy pagos_insert on public.pagos
  for insert to authenticated with check (true);

-- ----------------------------------------------------------------------------
-- Permisos (defensa en profundidad junto a RLS)
-- ----------------------------------------------------------------------------
revoke all on public.productos, public.clientes, public.facturas,
  public.factura_items, public.pagos from anon, public;

grant select, insert, update, delete on public.productos to authenticated;
grant select, insert, update, delete on public.clientes  to authenticated;
grant select, insert on public.facturas      to authenticated;
grant select, insert on public.factura_items to authenticated;
grant select, insert on public.pagos         to authenticated;

-- La vista es solo lectura; se apoya en RLS de las tablas (security_invoker).
revoke all on public.facturas_con_saldo from anon, public;
grant select on public.facturas_con_saldo to authenticated;
