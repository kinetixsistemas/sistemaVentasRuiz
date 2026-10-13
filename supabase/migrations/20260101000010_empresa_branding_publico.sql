-- ============================================================================
-- 0010 · Lectura pública de la marca de la empresa (pantalla de login)
-- La pantalla de acceso se muestra antes de autenticar, por lo que necesita el
-- nombre/razón social y el logotipo. Se exponen SOLO esas columnas a `anon`;
-- el resto (RIF, teléfono, correo, dirección) sigue restringido a `authenticated`.
-- ============================================================================

create policy empresa_select_publica on public.empresa
  for select to anon using (true);

-- Privilegios a nivel de columna: `anon` solo puede leer las columnas de marca.
-- `id` es necesario porque la consulta filtra por `id = 1` (singleton).
grant select (id, nombre_comercial, razon_social, logo_url) on public.empresa to anon;
