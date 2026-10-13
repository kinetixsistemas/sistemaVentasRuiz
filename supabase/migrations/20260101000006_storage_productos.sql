-- ============================================================================
-- 0006 · Storage: bucket `productos`
-- Lectura pública (imágenes del inventario), escritura solo para `authenticated`.
-- Límite de 1 MB porque la foto llega ya comprimida desde el front.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'productos',
  'productos',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lectura pública de las fotos del bucket
drop policy if exists "productos_lectura_publica" on storage.objects;
create policy "productos_lectura_publica" on storage.objects
  for select
  using (bucket_id = 'productos');

-- Escritura solo para usuarios autenticados
drop policy if exists "productos_insert_auth" on storage.objects;
create policy "productos_insert_auth" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'productos');

drop policy if exists "productos_update_auth" on storage.objects;
create policy "productos_update_auth" on storage.objects
  for update to authenticated
  using (bucket_id = 'productos')
  with check (bucket_id = 'productos');

drop policy if exists "productos_delete_auth" on storage.objects;
create policy "productos_delete_auth" on storage.objects
  for delete to authenticated
  using (bucket_id = 'productos');
