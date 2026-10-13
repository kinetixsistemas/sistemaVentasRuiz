-- ============================================================================
-- 0013 · Fix: lectura pública de la marca de la empresa
-- La migración 0010 concedió a `anon` privilegios de columna sobre
-- `nombre_comercial`, `razon_social` y `logo_url`, pero la consulta de la
-- pantalla de login filtra por `id = 1`; PostgreSQL exige el privilegio SELECT
-- también sobre la columna `id`. Sin él, la lectura fallaba con
-- "permission denied for table empresa".
-- ============================================================================

grant select (id) on public.empresa to anon;
