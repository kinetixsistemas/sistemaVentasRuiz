-- ============================================================================
-- 0012 · Endurecimiento de RLS y funciones
--   - `handle_new_user` es una función de trigger SECURITY DEFINER: no debe ser
--     invocable desde la API (anon/authenticated). Los triggers se ejecutan sin
--     comprobar privilegios EXECUTE, por lo que revocarlo es seguro.
--   - `perfiles_update`: evaluar `auth.uid()` una sola vez por consulta
--     (InitPlan) en lugar de una vez por fila.
-- ============================================================================

revoke all on function public.handle_new_user() from public, anon, authenticated;

alter policy perfiles_update on public.perfiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
