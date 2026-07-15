-- ModelMarket — RPC para crear una marca desde el cliente de forma controlada.
-- Los usuarios autenticados NO pueden insertar en `brands` directamente (sin GRANT/policy);
-- esta función SECURITY DEFINER inserta con dedup por slug (case/acentos-insensible) y
-- devuelve el id, así que "Tamiya" no se duplica aunque dos usuarios la creen a la vez.

create or replace function public.get_or_create_brand(_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _slug text;
  _id   uuid;
begin
  if _name is null or btrim(_name) = '' then
    raise exception 'El nombre de la marca es obligatorio';
  end if;

  -- Slug: minúsculas, sin acentos, no-alfanumérico -> guiones.
  _slug := translate(lower(btrim(_name)), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc');
  _slug := regexp_replace(_slug, '[^a-z0-9]+', '-', 'g');
  _slug := btrim(_slug, '-');
  if _slug = '' then
    raise exception 'Nombre de marca inválido';
  end if;

  select id into _id from public.brands where slug = _slug;
  if _id is null then
    insert into public.brands (name, slug) values (btrim(_name), _slug) returning id into _id;
  end if;

  return _id;
end;
$$;

-- Mínimo privilegio: Postgres concede EXECUTE a PUBLIC por defecto, así que un simple
-- grant a authenticated NO impide que anon la llame. Revocamos el default y concedemos
-- solo a authenticated (únicos que publican anuncios/peticiones).
revoke execute on function public.get_or_create_brand(text) from public;
revoke execute on function public.get_or_create_brand(text) from anon;
grant execute on function public.get_or_create_brand(text) to authenticated;
