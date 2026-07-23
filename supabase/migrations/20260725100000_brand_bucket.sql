-- Bucket `brand`: recursos de marca servidos por URL pública estable.
--
-- Nace para el logotipo de los emails. Un correo no puede referenciar un fichero del
-- proyecto ni un asset servido por el bundler: necesita una URL absoluta y accesible sin
-- sesión desde el cliente de correo de quien lo recibe.
--
-- Por qué aquí y no en `public/` de la aplicación: eso lo ataría a que APP_URL apunte a un
-- sitio desplegado y vivo. El bucket funciona desde el primer día e independientemente del
-- estado del dominio.

insert into storage.buckets (id, name, public)
values ('brand', 'brand', true)
on conflict (id) do nothing;

-- Lectura pública: es el punto de todo, que lo cargue un cliente de correo cualquiera.
drop policy if exists "brand_public_read" on storage.objects;
create policy "brand_public_read"
  on storage.objects
  for select
  using (bucket_id = 'brand');

-- Escritura solo para administradores. A diferencia de avatars o listing-photos, esto no
-- es contenido de usuario: son recursos de la marca y no debe tocarlos cualquiera.
drop policy if exists "brand_write_admin" on storage.objects;
create policy "brand_write_admin"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'brand' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "brand_update_admin" on storage.objects;
create policy "brand_update_admin"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'brand' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "brand_delete_admin" on storage.objects;
create policy "brand_delete_admin"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'brand' and public.has_role(auth.uid(), 'admin'));
