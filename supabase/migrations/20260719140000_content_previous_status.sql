-- ModelMarket · M6 fase 3 — Restaurar contenido a su estado previo.
--
-- Detectado al verificar: retirar y restaurar un anuncio lo dejaba en 'active'
-- aunque estuviera 'reserved'. Se perdía la reserva, que tiene significado de
-- negocio (había una oferta aceptada).
--
-- Se guarda el estado anterior al retirar y se recupera al restaurar. Va en RPC
-- (no en dos consultas del cliente) para que leer-y-escribir sea atómico: si el
-- estado cambiara entre ambas, se guardaría un valor equivocado.

alter table public.listings
  add column if not exists previous_status public.listing_status;

alter table public.requests
  add column if not exists previous_status public.request_status;

-- ============================================================================
-- Retirar: guarda el estado actual y oculta el contenido.
-- ============================================================================
create or replace function public.admin_take_down(_kind text, _id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Solo administradores';
  end if;

  if _kind = 'listing' then
    update public.listings
       set previous_status = case when status = 'archived' then previous_status else status end,
           status = 'archived'
     where id = _id;
  elsif _kind = 'request' then
    update public.requests
       set previous_status = case when status = 'closed' then previous_status else status end,
           status = 'closed'
     where id = _id;
  else
    raise exception 'Tipo de contenido inválido';
  end if;
end;
$$;

-- ============================================================================
-- Restaurar: vuelve al estado previo. Si no hay guardado (contenido retirado
-- antes de existir esta columna), cae al estado público por defecto.
-- ============================================================================
create or replace function public.admin_restore(_kind text, _id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Solo administradores';
  end if;

  if _kind = 'listing' then
    update public.listings
       set status = coalesce(previous_status, 'active'::public.listing_status),
           previous_status = null
     where id = _id;
  elsif _kind = 'request' then
    update public.requests
       set status = coalesce(previous_status, 'open'::public.request_status),
           previous_status = null
     where id = _id;
  else
    raise exception 'Tipo de contenido inválido';
  end if;
end;
$$;

revoke execute on function public.admin_take_down(text, uuid) from public;
revoke execute on function public.admin_restore(text, uuid) from public;
grant execute on function public.admin_take_down(text, uuid) to authenticated;
grant execute on function public.admin_restore(text, uuid) to authenticated;
