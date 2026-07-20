-- Suspensión de usuarios por moderación.
--
-- Tabla propia y no columnas en `profiles` a propósito: la policy `profiles_select_all`
-- es `using (true)` para el rol public, asi que CUALQUIER columna de profiles la puede
-- leer cualquiera, incluido un visitante sin cuenta. El motivo de una suspensión es una
-- nota de moderación sobre una persona y no puede ser público.
--
-- El bloqueo real del acceso NO vive aquí: se hace baneando al usuario en el sistema de
-- autenticación desde la Edge Function (con service_role). Esta tabla es el registro que
-- consulta la aplicación, y lo que permite ocultar su contenido.

create table if not exists public.user_suspensions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null,
  suspended_at timestamptz not null default now(),
  suspended_by uuid references auth.users(id) on delete set null
);

grant select on public.user_suspensions to authenticated;
-- Sin INSERT/UPDATE/DELETE para nadie: solo la Edge Function con service_role, que es
-- quien ademas banea en auth. Si se pudiera escribir desde el cliente, la fila y el baneo
-- podrian quedar descuadrados.

alter table public.user_suspensions enable row level security;

drop policy if exists "user_suspensions_select_own_or_admin" on public.user_suspensions;
create policy "user_suspensions_select_own_or_admin"
  on public.user_suspensions
  for select
  to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- Se usa dentro de las policies de listings/requests, por eso SECURITY DEFINER: quien
-- consulta el catalogo no tiene (ni debe tener) permiso de lectura sobre la tabla.
create or replace function public.is_suspended(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_suspensions s where s.user_id = _user_id);
$$;

-- ── Ocultar el contenido de los suspendidos ──────────────────────────────────
-- Se anade `not is_suspended(user_id)` solo a la rama publica. El dueno sigue viendo lo
-- suyo (aunque no pueda entrar, si se levanta la suspension lo recupera intacto) y el
-- admin tambien, para poder moderarlo.

drop policy if exists "listings_select_public" on public.listings;
create policy "listings_select_public"
  on public.listings
  for select
  using (
    (
      status = any (array['active'::public.listing_status, 'reserved'::public.listing_status])
      and visible_at <= now()
      and not public.is_suspended(user_id)
    )
    or auth.uid() = user_id
    or public.has_role(auth.uid(), 'admin')
  );

drop policy if exists "requests_select_public" on public.requests;
create policy "requests_select_public"
  on public.requests
  for select
  using (
    (status = 'open'::public.request_status and not public.is_suspended(user_id))
    or auth.uid() = user_id
    or public.has_role(auth.uid(), 'admin')
  );

-- ── El panel necesita ver quien esta suspendido y por que ────────────────────
-- DROP y no CREATE OR REPLACE: cambia el tipo de retorno (dos columnas nuevas) y
-- Postgres no permite reemplazar una funcion con OUT distintos.
drop function if exists public.admin_users();

create function public.admin_users()
returns table(
  id uuid, email text, display_name text, username text, location text, avatar_url text,
  is_admin boolean, tier public.subscription_plan,
  listings_count integer, requests_count integer, reports_count integer,
  created_at timestamptz,
  suspended_at timestamptz, suspension_reason text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Solo administradores';
  end if;

  return query
  select
    p.id,
    u.email::text,
    p.display_name,
    p.username,
    p.location,
    p.avatar_url,
    public.has_role(p.id, 'admin') as is_admin,
    coalesce(s.tier, 'free'::public.subscription_plan) as tier,
    (select count(*)::int from public.listings l where l.user_id = p.id),
    (select count(*)::int from public.requests r where r.user_id = p.id),
    (select count(*)::int
       from public.reports rp
      where rp.reported_user_id = p.id
         or rp.listing_id in (select l.id from public.listings l where l.user_id = p.id)
         or rp.request_id in (select r.id from public.requests r where r.user_id = p.id)),
    p.created_at,
    sus.suspended_at,
    sus.reason
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.subscriptions s on s.user_id = p.id and s.status = 'active'
  left join public.user_suspensions sus on sus.user_id = p.id
  order by p.created_at desc;
end;
$function$;
