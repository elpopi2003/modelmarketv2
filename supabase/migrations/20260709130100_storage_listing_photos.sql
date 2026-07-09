-- ModelMarket · M3 — Storage para fotos de anuncios.
--
-- NOTA: esto toca el schema reservado `storage`. Es el punto de extensión previsto por
-- Supabase (bucket + políticas sobre storage.objects), no una modificación de su estructura.
-- Si gestionas Storage con el tooling de Lovable, crea allí el bucket `listing-photos`
-- (público) y estas mismas políticas. Si no, ejecuta este fichero en el SQL Editor.

-- Bucket público para las fotos.
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

-- Lectura pública.
drop policy if exists "listing_photos_public_read" on storage.objects;
create policy "listing_photos_public_read"
  on storage.objects
  for select
  using (bucket_id = 'listing-photos');

-- Cada usuario sube/gestiona fotos SOLO dentro de su carpeta (primer segmento = su user id).
drop policy if exists "listing_photos_insert_own" on storage.objects;
create policy "listing_photos_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "listing_photos_update_own" on storage.objects;
create policy "listing_photos_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "listing_photos_delete_own" on storage.objects;
create policy "listing_photos_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
