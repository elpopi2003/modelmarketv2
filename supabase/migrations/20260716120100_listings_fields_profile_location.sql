-- ModelMarket · Diseño — Campos de anuncio y ubicación de perfil (paridad con staging).
--
-- Ejecutar DESPUÉS de 20260716120000_listing_status_reserved.sql.
--
-- Incluye:
--   1. condition -> taxonomía Precintado/Abierto/Empezado (sealed/opened/started)
--   2. decals    -> Perfectas/Amarilleadas/No disponibles ("Calcas OK" es derivado: = perfect)
--   3. entrega   -> envío InPost + entrega en mano (dos booleanos: pueden ofrecerse ambos)
--   4. ref_number-> referencia secuencial visible ("Ref: 1195")
--   5. views     -> contador de visitas + RPC de incremento
--   6. profiles.location -> ubicación pública ("45003, Toledo")

-- ============================================================================
-- 1. Condición: new/like_new/used/for_parts -> sealed/opened/started
--    Postgres no permite quitar valores de un enum: se crea uno nuevo y se cambia.
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'listing_condition_new') then
    create type public.listing_condition_new as enum ('sealed', 'opened', 'started');
  end if;
end $$;

alter table public.listings alter column condition drop default;

alter table public.listings
  alter column condition type public.listing_condition_new
  using (
    case condition::text
      when 'new'       then 'sealed'
      when 'like_new'  then 'opened'
      when 'used'      then 'started'
      when 'for_parts' then 'started'
      else 'started'
    end
  )::public.listing_condition_new;

drop type public.listing_condition;
alter type public.listing_condition_new rename to listing_condition;

alter table public.listings
  alter column condition set default 'sealed'::public.listing_condition;

-- ============================================================================
-- 2. Calcas
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'decals_status') then
    create type public.decals_status as enum ('perfect', 'yellowed', 'unavailable');
  end if;
end $$;

alter table public.listings
  add column if not exists decals public.decals_status not null default 'perfect';

-- ============================================================================
-- 3. Método de entrega (la integración con la API de InPost queda pendiente;
--    aquí solo se registra que el vendedor ofrece cada modalidad)
-- ============================================================================
alter table public.listings
  add column if not exists shipping_inpost boolean not null default false,
  add column if not exists hand_delivery   boolean not null default false;

-- ============================================================================
-- 4. Referencia secuencial visible
-- ============================================================================
create sequence if not exists public.listings_ref_seq as bigint start with 1000;

alter table public.listings
  add column if not exists ref_number bigint not null default nextval('public.listings_ref_seq');

alter sequence public.listings_ref_seq owned by public.listings.ref_number;

create unique index if not exists listings_ref_number_idx on public.listings (ref_number);

-- Necesario para que el default nextval() funcione al insertar desde el cliente.
grant usage, select on sequence public.listings_ref_seq to authenticated;

-- ============================================================================
-- 5. Visitas
-- ============================================================================
alter table public.listings
  add column if not exists views integer not null default 0 check (views >= 0);

-- El trigger de updated_at debe ignorar los incrementos de visitas: si no, cada
-- visita "tocaría" el anuncio. Solo marca updated_at cuando `views` NO cambia.
drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
  before update on public.listings
  for each row
  when (old.views is not distinct from new.views)
  execute function public.set_updated_at();

-- Incremento de visitas: los usuarios no tienen UPDATE sobre anuncios ajenos,
-- así que se expone vía SECURITY DEFINER con mínimo privilegio.
create or replace function public.increment_listing_views(_listing_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.listings
     set views = views + 1
   where id = _listing_id
     and status <> 'draft';
$$;

revoke execute on function public.increment_listing_views(uuid) from public;
grant execute on function public.increment_listing_views(uuid) to anon, authenticated;

-- ============================================================================
-- 6. Ubicación pública del perfil
-- ============================================================================
alter table public.profiles
  add column if not exists location text;
