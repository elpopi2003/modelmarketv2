-- ModelMarket · M4 — Peticiones (requests) y favoritos.
-- Orden: TYPE -> CREATE TABLE -> GRANT -> ENABLE RLS -> CREATE POLICY.

-- ============================================================================
-- Enum de estado de petición
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type public.request_status as enum ('open', 'fulfilled', 'closed');
  end if;
end $$;

-- ============================================================================
-- requests  ("busco X")
-- ============================================================================
create table if not exists public.requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  title           text not null check (char_length(title) between 3 and 120),
  description     text,
  category_id     uuid references public.categories (id) on delete set null,
  brand_id        uuid references public.brands (id) on delete set null,
  scale           text,
  max_price_cents integer check (max_price_cents is null or max_price_cents >= 0),
  photos          text[] not null default '{}',
  status          public.request_status not null default 'open',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists requests_user_id_idx on public.requests (user_id);
create index if not exists requests_status_idx on public.requests (status);
create index if not exists requests_category_idx on public.requests (category_id);
create index if not exists requests_brand_idx on public.requests (brand_id);
create index if not exists requests_created_at_idx on public.requests (created_at desc);

grant select on public.requests to anon, authenticated;
grant insert, update, delete on public.requests to authenticated;

alter table public.requests enable row level security;

-- Lectura pública: peticiones abiertas. El dueño ve siempre las suyas.
create policy "requests_select_public"
  on public.requests
  for select
  using (status = 'open' or auth.uid() = user_id);

create policy "requests_insert_own"
  on public.requests
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "requests_update_own"
  on public.requests
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "requests_delete_own"
  on public.requests
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists requests_set_updated_at on public.requests;
create trigger requests_set_updated_at
  before update on public.requests
  for each row execute function public.set_updated_at();

-- ============================================================================
-- favorites
-- Solo el dueño ve/gestiona sus favoritos (sin lectura pública de quién marca qué).
-- El contador público se expone por RPC SECURITY DEFINER (convención).
-- ============================================================================
create table if not exists public.favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

create index if not exists favorites_listing_idx on public.favorites (listing_id);

grant select, insert, delete on public.favorites to authenticated;

alter table public.favorites enable row level security;

create policy "favorites_select_own"
  on public.favorites
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "favorites_insert_own"
  on public.favorites
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "favorites_delete_own"
  on public.favorites
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Contador público de favoritos de un anuncio (sin SELECT directo sobre favorites).
create or replace function public.listing_favorite_count(_listing_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.favorites where listing_id = _listing_id;
$$;

grant execute on function public.listing_favorite_count(uuid) to anon, authenticated;
