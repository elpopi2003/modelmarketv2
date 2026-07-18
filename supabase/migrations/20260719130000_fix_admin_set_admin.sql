-- ModelMarket · M6 fase 3 — Corrección de admin_set_admin.
--
-- Detectado al verificar: degradar a un usuario que NO es administrador lanzaba
-- "Debe quedar al menos un administrador". La salvaguarda del último admin se
-- evaluaba antes de comprobar si el objetivo tenía siquiera el rol, así que
-- convertía una operación inocua (no-op) en un error con un mensaje engañoso.
--
-- Ahora: si el objetivo no es admin, no hay nada que hacer y se sale sin error.
-- Las dos salvaguardas reales se mantienen intactas.

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

  -- Si no es administrador, no hay nada que retirar: salida silenciosa.
  if not public.has_role(_user_id, 'admin') then
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
