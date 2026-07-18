-- ModelMarket · M6 — Reportes y capacidades de administración.
--
-- 1. Tabla `reports`: denuncias sobre un anuncio, una petición o un usuario.
-- 2. Políticas de admin sobre el contenido existente: hasta ahora NADIE podía
--    moderar (las policies solo contemplaban al dueño), así que un admin no podía
--    retirar contenido ajeno ni ver borradores denunciados.
-- 3. Notificación a los admins al recibir un reporte.
--
-- Roles siempre vía user_roles + has_role() (convención del proyecto).

-- ============================================================================
-- Enums
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'report_reason') then
    create type public.report_reason as enum (
      'spam',            -- publicidad o repetición masiva
      'prohibited',      -- artículo no permitido
      'counterfeit',     -- copia/falsificación
      'misleading',      -- descripción o fotos engañosas
      'offensive',       -- contenido ofensivo
      'other'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum ('pending', 'resolved', 'dismissed');
  end if;
end $$;

-- ============================================================================
-- reports
-- ============================================================================
create table if not exists public.reports (
  id                 uuid primary key default gen_random_uuid(),
  reporter_id        uuid not null references auth.users (id) on delete cascade,
  listing_id         uuid references public.listings (id) on delete cascade,
  request_id         uuid references public.requests (id) on delete cascade,
  reported_user_id   uuid references auth.users (id) on delete cascade,
  reason             public.report_reason not null,
  details            text check (details is null or char_length(details) <= 1000),
  status             public.report_status not null default 'pending',
  resolved_by        uuid references auth.users (id) on delete set null,
  resolved_at        timestamptz,
  resolution_note    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Exactamente un objetivo.
  constraint reports_target_check check (
    (listing_id is not null)::int
    + (request_id is not null)::int
    + (reported_user_id is not null)::int = 1
  ),
  -- No tiene sentido denunciarse a uno mismo.
  constraint reports_not_self check (reported_user_id is null or reported_user_id <> reporter_id)
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_listing_idx on public.reports (listing_id);
create index if not exists reports_request_idx on public.reports (request_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id);

-- Una denuncia viva por persona y objetivo (evita spam de reportes).
create unique index if not exists reports_unique_pending_listing
  on public.reports (reporter_id, listing_id)
  where listing_id is not null and status = 'pending';
create unique index if not exists reports_unique_pending_request
  on public.reports (reporter_id, request_id)
  where request_id is not null and status = 'pending';
create unique index if not exists reports_unique_pending_user
  on public.reports (reporter_id, reported_user_id)
  where reported_user_id is not null and status = 'pending';

grant select, insert on public.reports to authenticated;
grant update on public.reports to authenticated; -- restringido a admin por policy

alter table public.reports enable row level security;

-- Quien denuncia ve las suyas; los admins, todas.
drop policy if exists "reports_select_own_or_admin" on public.reports;
create policy "reports_select_own_or_admin"
  on public.reports
  for select
  to authenticated
  using (auth.uid() = reporter_id or public.has_role(auth.uid(), 'admin'));

-- Cualquier autenticado puede denunciar, siempre en su propio nombre.
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
  on public.reports
  for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- Solo los admins resuelven.
drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_update_admin"
  on public.reports
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Capacidades de moderación sobre el contenido existente
-- Se recrean las policies añadiendo la vía del admin.
-- ============================================================================

-- listings: el admin ve todo (incluidos borradores/archivados denunciados)…
drop policy if exists "listings_select_public" on public.listings;
create policy "listings_select_public"
  on public.listings
  for select
  using (
    (status in ('active', 'reserved') and visible_at <= now())
    or auth.uid() = user_id
    or public.has_role(auth.uid(), 'admin')
  );

-- …y puede retirarlo (cambiar estado a 'archived').
drop policy if exists "listings_update_own" on public.listings;
create policy "listings_update_own"
  on public.listings
  for update
  to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'))
  with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- requests: mismas dos capacidades.
drop policy if exists "requests_select_public" on public.requests;
create policy "requests_select_public"
  on public.requests
  for select
  using (
    status = 'open'
    or auth.uid() = user_id
    or public.has_role(auth.uid(), 'admin')
  );

drop policy if exists "requests_update_own" on public.requests;
create policy "requests_update_own"
  on public.requests
  for update
  to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'))
  with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- Contadores del panel (SECURITY DEFINER: cuentan sobre todo el contenido,
-- pero solo responden a admins).
-- ============================================================================
create or replace function public.admin_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _result json;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Solo administradores';
  end if;

  select json_build_object(
    'users', (select count(*) from public.profiles),
    'listings', (select count(*) from public.listings where status in ('active', 'reserved')),
    'requests', (select count(*) from public.requests where status = 'open'),
    'offers', (select count(*) from public.offers where status = 'pending'),
    'reports_pending', (select count(*) from public.reports where status = 'pending')
  ) into _result;

  return _result;
end;
$$;

revoke execute on function public.admin_stats() from public;
grant execute on function public.admin_stats() to authenticated;

-- ============================================================================
-- Notificación a admins al recibir un reporte
-- ============================================================================
create or replace function public.notify_admins_on_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin record;
  _what  text;
begin
  _what := case
    when new.listing_id is not null then 'un anuncio'
    when new.request_id is not null then 'una petición'
    else 'un usuario'
  end;

  for _admin in select user_id from public.user_roles where role = 'admin' loop
    insert into public.notifications (user_id, type, title, body, link)
    values (
      _admin.user_id,
      'report',
      'Nuevo reporte sobre ' || _what,
      'Motivo: ' || new.reason::text,
      '/admin/reportes'
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists reports_notify_admins on public.reports;
create trigger reports_notify_admins
  after insert on public.reports
  for each row execute function public.notify_admins_on_report();
