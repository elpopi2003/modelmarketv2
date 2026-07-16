-- ModelMarket · Diseño — Estado "Reservado" para anuncios.
--
-- IMPORTANTE: va en su propio fichero. PostgreSQL no permite USAR un valor de enum
-- recién añadido dentro de la misma transacción que lo añade, así que este ALTER debe
-- confirmarse antes de que otras migraciones (o el código) referencien 'reserved'.
-- Ejecutar ESTE primero y después 20260716120100_listings_fields_profile_location.sql.

alter type public.listing_status add value if not exists 'reserved' after 'active';
