-- ModelMarket · Seguridad — Impedir el listado de los buckets públicos.
--
-- Detectado con el linter de Supabase y confirmado en vivo: con solo la clave
-- publishable, un visitante anónimo podía enumerar `listing-photos` y `avatars`,
-- viendo los IDs de usuario (nombres de carpeta) y TODOS los ficheros subidos,
-- incluidos los de anuncios archivados o borradores.
--
-- Causa: la política `SELECT` amplia sobre storage.objects habilita la API de listado.
-- En un bucket PÚBLICO no hace falta para servir las imágenes: el endpoint
-- /storage/v1/object/public/... no evalúa RLS. Las fotos siguen viéndose igual.
--
-- Se conservan las políticas de insert/update/delete por carpeta de usuario, que son
-- las que permiten a cada uno subir y gestionar lo suyo.

drop policy if exists "listing_photos_public_read" on storage.objects;
drop policy if exists "avatars_public_read" on storage.objects;
