-- ModelMarket · M2 — Perfiles de usuario y roles.
-- Convención de orden: CREATE TABLE -> GRANT -> ENABLE RLS -> CREATE POLICY (en el mismo fichero).
-- Roles SIEMPRE en public.user_roles + has_role(); nunca en profiles.

-- ============================================================================
-- Enum de roles
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'user');
  end if;
end $$;

-- ============================================================================
-- profiles
-- Campos públicos y seguros (el email vive en auth.users, NO aquí).
-- ============================================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text unique,
  display_name text,
  avatar_url   text,
  bio          text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

alter table public.profiles enable row level security;

-- Lectura pública: los perfiles solo contienen datos no sensibles.
create policy "profiles_select_all"
  on public.profiles
  for select
  using (true);

-- Cada usuario crea y edita únicamente su propio perfil.
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================================
-- user_roles
-- Sin GRANT de insert/update a authenticated: los roles se gestionan server-side
-- (trigger de alta como 'user', y admins/service_role para el resto). Evita escalado.
-- ============================================================================
create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;

alter table public.user_roles enable row level security;

-- has_role: SECURITY DEFINER para consultar roles sin recursión de RLS.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

-- Un usuario ve sus propios roles; un admin ve todos.
create policy "user_roles_select_own_or_admin"
  on public.user_roles
  for select
  to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- Triggers
-- ============================================================================

-- Mantiene updated_at en cada UPDATE de profiles.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Al registrar un usuario: crea su profile y le asigna el rol 'user'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
