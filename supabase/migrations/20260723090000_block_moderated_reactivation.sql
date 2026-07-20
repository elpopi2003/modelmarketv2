-- El dueño puede suspender y reactivar su propio contenido. Pero "suspendido" comparte
-- estado con "retirado por moderación" (archived / closed), y la policy de UPDATE deja al
-- dueño tocar cualquier columna. Sin esto, un usuario podría deshacer una retirada de un
-- administrador simplemente reactivando su anuncio.
--
-- Se distinguen por `previous_status`: la retirada administrativa lo rellena (para saber a
-- qué estado volver) y la restauración lo limpia. Una suspensión del dueño lo deja a null.

create or replace function public.prevent_moderated_reactivation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() nulo = no hay sesión de usuario (service_role, tareas de mantenimiento,
  -- triggers internos). Ahí no se aplica: para el acceso anónimo la RLS ya bloquea el
  -- UPDATE por su cuenta, así que esto solo restringiría al backend de confianza.
  if auth.uid() is not null
     and old.previous_status is not null
     and new.status is distinct from old.status
     and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Contenido retirado por moderación: solo un administrador puede restaurarlo'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_block_moderated_reactivation on public.listings;
create trigger listings_block_moderated_reactivation
  before update on public.listings
  for each row
  execute function public.prevent_moderated_reactivation();

drop trigger if exists requests_block_moderated_reactivation on public.requests;
create trigger requests_block_moderated_reactivation
  before update on public.requests
  for each row
  execute function public.prevent_moderated_reactivation();
