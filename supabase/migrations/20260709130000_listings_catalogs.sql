-- ModelMarket · M3 — Catálogos (brands, categories) y anuncios (listings).
-- Orden: TYPES -> CREATE TABLE -> GRANT -> ENABLE RLS -> CREATE POLICY -> SEEDS.

-- ============================================================================
-- Enums
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'listing_condition') then
    create type public.listing_condition as enum ('new', 'like_new', 'used', 'for_parts');
  end if;
  if not exists (select 1 from pg_type where typname = 'listing_status') then
    create type public.listing_status as enum ('draft', 'active', 'sold', 'archived');
  end if;
end $$;

-- ============================================================================
-- brands (catálogo, solo lectura para clientes; se gestiona server-side)
-- ============================================================================
create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

grant select on public.brands to anon, authenticated;
alter table public.brands enable row level security;
create policy "brands_select_all" on public.brands for select using (true);

-- ============================================================================
-- categories (jerárquicas vía parent_id)
-- ============================================================================
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  parent_id  uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now()
);

grant select on public.categories to anon, authenticated;
alter table public.categories enable row level security;
create policy "categories_select_all" on public.categories for select using (true);

-- ============================================================================
-- listings
-- ============================================================================
create table if not exists public.listings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 120),
  description text,
  price_cents integer not null default 0 check (price_cents >= 0),
  currency    text not null default 'EUR',
  condition   public.listing_condition not null default 'used',
  scale       text,
  category_id uuid references public.categories (id) on delete set null,
  brand_id    uuid references public.brands (id) on delete set null,
  photos      text[] not null default '{}',
  status      public.listing_status not null default 'active',
  -- Cuándo pasa a ser públicamente visible (Free = ahora + 24h; PRO/Retail = ahora).
  visible_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists listings_user_id_idx on public.listings (user_id);
create index if not exists listings_status_visible_idx on public.listings (status, visible_at);
create index if not exists listings_category_idx on public.listings (category_id);
create index if not exists listings_brand_idx on public.listings (brand_id);
create index if not exists listings_created_at_idx on public.listings (created_at desc);

grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;

alter table public.listings enable row level security;

-- Lectura pública: anuncios activos y ya visibles. El dueño ve siempre los suyos.
create policy "listings_select_public"
  on public.listings
  for select
  using (
    (status = 'active' and visible_at <= now())
    or auth.uid() = user_id
  );

create policy "listings_insert_own"
  on public.listings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "listings_update_own"
  on public.listings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "listings_delete_own"
  on public.listings
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Semillas de catálogo
-- ============================================================================
insert into public.brands (name, slug) values
  ('Tamiya', 'tamiya'),
  ('Revell', 'revell'),
  ('Airfix', 'airfix'),
  ('Italeri', 'italeri'),
  ('Hasegawa', 'hasegawa'),
  ('Trumpeter', 'trumpeter'),
  ('Academy', 'academy'),
  ('Zvezda', 'zvezda')
on conflict (slug) do nothing;

insert into public.categories (name, slug) values
  ('Aviación', 'aviacion'),
  ('Vehículos militares', 'vehiculos-militares'),
  ('Automóviles', 'automoviles'),
  ('Barcos', 'barcos'),
  ('Trenes', 'trenes'),
  ('Figuras', 'figuras'),
  ('Ciencia ficción', 'ciencia-ficcion'),
  ('Dioramas y accesorios', 'dioramas-accesorios')
on conflict (slug) do nothing;
