-- ============================================================================
-- 0011 · Endurecimiento del acceso anónimo
-- La versión anterior de esta migración exponía `productos`, `clientes`,
-- `facturas`, `factura_items` y `pagos` al rol `anon` (lectura sin sesión).
-- Eso es una fuga de datos: la pantalla de login solo necesita la marca de la
-- empresa (ver migración 0010). Aquí se revierte ese acceso y se refuerzan los
-- privilegios como defensa en profundidad.
-- ============================================================================

-- 1) Eliminar cualquier política de lectura anónima sobre datos de negocio.
drop policy if exists productos_select_anon     on public.productos;
drop policy if exists clientes_select_anon      on public.clientes;
drop policy if exists facturas_select_anon      on public.facturas;
drop policy if exists factura_items_select_anon on public.factura_items;
drop policy if exists pagos_select_anon         on public.pagos;

-- 2) Revocar privilegios directos de `anon`.
revoke all on public.productos           from anon;
revoke all on public.clientes            from anon;
revoke all on public.facturas            from anon;
revoke all on public.factura_items       from anon;
revoke all on public.pagos               from anon;
revoke all on public.facturas_con_saldo  from anon;

-- 3) La función auxiliar de Supabase no debe ser invocable desde la API pública.
do $$
begin
  if exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
