-- ModelMarket · Perfil y Configuración — avatares y preferencias de notificación.
--
-- 1. Bucket público `avatars` (mismo patrón que listing-photos: carpeta = user id).
-- 2. profiles.notify_email / notify_push: preferencias de alertas del usuario.
--    Nota: las Edge Functions de email deberán consultar notify_email antes de
--    enviar (pendiente de cablear en la capa de emails, M6).

-- ============================================================================
-- 1. Storage: avatares
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- 2. Preferencias de notificación
-- ============================================================================
alter table public.profiles
  add column if not exists notify_email boolean not null default true,
  add column if not exists notify_push boolean not null default false;
