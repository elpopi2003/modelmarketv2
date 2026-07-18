-- ModelMarket · M6 fase 3 — Gestión de usuarios y contenido.
--
-- 1. Borrado de denuncias: permitido, pero SOLO a administradores.
-- 2. admin_users(): listado de usuarios con email, rol, plan y actividad.
--    Necesita SECURITY DEFINER porque los emails viven en auth.users, que no está
--    expuesta al cliente. Solo responde a admins.
-- 3. admin_set_admin(): promover/degradar administradores, con dos salvaguardas
--    para no quedarse sin acceso al panel.

-- ============================================================================
-- 1. Borrado de denuncias (solo admin)
-- ============================================================================
grant delete on public.reports to authenticated;

drop policy if exists "reports_delete_admin" on public.reports;
create policy "reports_delete_admin"
  on public.reports
  for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 2. Listado de usuarios para el panel
-- ============================================================================
create or replace function public.admin_users()
returns table (
  id             uuid,
  email          text,
  display_name   text,
  username       text,
  location       text,
  avatar_url     text,
  is_admin       boolean,
  tier           public.subscription_plan,
  listings_count integer,
  requests_count integer,
  reports_count  integer,
  created_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
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
    -- Denuncias recibidas sobre el usuario o sobre su contenido.
    (select count(*)::int
       from public.reports rp
      where rp.reported_user_id = p.id
         or rp.listing_id in (select l.id from public.listings l where l.user_id = p.id)
         or rp.request_id in (select r.id from public.requests r where r.user_id = p.id)),
    p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.subscriptions s on s.user_id = p.id and s.status = 'active'
  order by p.created_at desc;
end;
$$;

revoke execute on function public.admin_users() from public;
grant execute on function public.admin_users() to authenticated;

-- ============================================================================
-- 3. Promover / degradar administradores
-- ============================================================================
create or replace function public.admin_set_admin(_user_id uuid, _make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin_count integer;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Solo administradores';
  end if;

  if _make_admin then
    insert into public.user_roles (user_id, role)
    values (_user_id, 'admin')
    on conflict (user_id, role) do nothing;
    return;
  end if;

  -- Salvaguarda 1: nadie se degrada a sí mismo (evita perder el panel por accidente).
  if _user_id = auth.uid() then
    raise exception 'No puedes retirarte a ti mismo el rol de administrador';
  end if;

  -- Salvaguarda 2: siempre debe quedar al menos un administrador.
  select count(*) into _admin_count from public.user_roles where role = 'admin';
  if _admin_count <= 1 then
    raise exception 'Debe quedar al menos un administrador';
  end if;

  delete from public.user_roles where user_id = _user_id and role = 'admin';
end;
$$;

revoke execute on function public.admin_set_admin(uuid, boolean) from public;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
