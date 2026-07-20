-- La moderación tiene prioridad sobre el dueño. Si un administrador retira un anuncio o
-- una petición, su autor no puede reactivarlo (trigger anterior) ni borrarlo (este).
--
-- Borrar también estaba abierto: el autor podía hacer desaparecer contenido retirado y,
-- en cascada, los reportes que lo documentan. Es decir, borrar servía como vía de escape
-- a la moderación y además destruía el historial que la justifica.
--
-- `previous_status` distingue la retirada administrativa (lo rellena) de una suspensión
-- del propio dueño (lo deja a null).

create or replace function public.prevent_moderated_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() nulo = sin sesión de usuario (service_role, borrado de cuenta desde una
  -- Edge Function, mantenimiento). Ahí no aplica: para el anónimo la RLS ya bloquea.
  if auth.uid() is not null
     and old.previous_status is not null
     and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Contenido retirado por moderación: solo un administrador puede eliminarlo'
      using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists listings_block_moderated_deletion on public.listings;
create trigger listings_block_moderated_deletion
  before delete on public.listings
  for each row
  execute function public.prevent_moderated_deletion();

drop trigger if exists requests_block_moderated_deletion on public.requests;
create trigger requests_block_moderated_deletion
  before delete on public.requests
  for each row
  execute function public.prevent_moderated_deletion();

-- Simetría con las peticiones: un administrador también puede borrar anuncios. Sin esto,
-- lo retirado por moderación quedaría en un limbo donde ni el dueño ni el admin lo borran.
drop policy if exists "listings_delete_own" on public.listings;
create policy "listings_delete_own"
  on public.listings
  for delete
  to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
