-- ModelMarket · Ofertas.
--
-- Una oferta es un importe + mensaje sobre un ANUNCIO o una PETICIÓN, que abre
-- (o reutiliza) la conversación entre las partes y tiene ciclo de vida
-- (pendiente -> aceptada / rechazada / retirada).
--
-- Decisiones:
--   * Conversaciones generalizadas: cuelgan de un anuncio O de una petición.
--     La semántica de buyer/seller se mantiene: en un anuncio el dueño vende;
--     en una petición el autor compra y quien oferta vende.
--   * El gate PRO/Retail aplica SOLO a ofertas sobre peticiones (contactar al autor
--     es de pago). Ofertar sobre un anuncio es gratis: es el flujo básico del market.
--     Se valida en la RPC, no solo en la UI.
--   * Todas las escrituras van por RPC SECURITY DEFINER: `offers` no tiene GRANT de
--     insert/update, así el gate y las validaciones no se pueden saltar desde el cliente.

-- ============================================================================
-- Tipos
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'offer_status') then
    create type public.offer_status as enum ('pending', 'accepted', 'rejected', 'withdrawn');
  end if;
end $$;

-- ============================================================================
-- 1. Conversaciones: de "solo anuncios" a "anuncio o petición"
-- ============================================================================
alter table public.conversations
  alter column listing_id drop not null;

alter table public.conversations
  add column if not exists request_id uuid references public.requests (id) on delete cascade;

-- Exactamente uno de los dos.
alter table public.conversations
  drop constraint if exists conversations_target_check;
alter table public.conversations
  add constraint conversations_target_check
  check ((listing_id is not null) <> (request_id is not null));

-- La unicidad antigua (listing_id, buyer_id) deja de valer con listing_id nulo.
alter table public.conversations
  drop constraint if exists conversations_listing_id_buyer_id_key;

-- Anuncio: una conversación por (anuncio, comprador interesado).
create unique index if not exists conversations_listing_buyer_uidx
  on public.conversations (listing_id, buyer_id)
  where listing_id is not null;

-- Petición: una conversación por (petición, ofertante). El autor es el buyer.
create unique index if not exists conversations_request_seller_uidx
  on public.conversations (request_id, seller_id)
  where request_id is not null;

create index if not exists conversations_request_idx on public.conversations (request_id);

-- ============================================================================
-- 2. Mensajes: distinguir el mensaje generado por una oferta
-- ============================================================================
alter table public.messages
  add column if not exists kind text not null default 'text';

alter table public.messages
  drop constraint if exists messages_kind_check;
alter table public.messages
  add constraint messages_kind_check check (kind in ('text', 'offer'));

-- ============================================================================
-- 3. offers
-- ============================================================================
create table if not exists public.offers (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid references public.listings (id) on delete cascade,
  request_id      uuid references public.requests (id) on delete cascade,
  from_user_id    uuid not null references auth.users (id) on delete cascade,
  to_user_id      uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  amount_cents    integer not null check (amount_cents >= 0 and amount_cents <= 100000000),
  message         text,
  status          public.offer_status not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint offers_target_check check ((listing_id is not null) <> (request_id is not null)),
  constraint offers_not_self check (from_user_id <> to_user_id)
);

create index if not exists offers_listing_idx on public.offers (listing_id);
create index if not exists offers_request_idx on public.offers (request_id);
create index if not exists offers_from_idx on public.offers (from_user_id, created_at desc);
create index if not exists offers_to_idx on public.offers (to_user_id, created_at desc);

-- Una sola oferta viva por persona y objetivo (se puede volver a ofertar tras rechazo).
create unique index if not exists offers_listing_from_pending_uidx
  on public.offers (listing_id, from_user_id)
  where listing_id is not null and status = 'pending';
create unique index if not exists offers_request_from_pending_uidx
  on public.offers (request_id, from_user_id)
  where request_id is not null and status = 'pending';

-- Solo lectura para el cliente: crear/responder va por RPC.
grant select on public.offers to authenticated;

alter table public.offers enable row level security;

-- CREATE POLICY no admite IF NOT EXISTS: se recrea para que la migración sea re-ejecutable.
drop policy if exists "offers_select_involved" on public.offers;
create policy "offers_select_involved"
  on public.offers
  for select
  to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

drop trigger if exists offers_set_updated_at on public.offers;
create trigger offers_set_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 4. Contadores públicos ("N ofertas")
-- ============================================================================
create or replace function public.request_offer_count(_request_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.offers
  where request_id = _request_id and status <> 'withdrawn';
$$;

create or replace function public.listing_offer_count(_listing_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.offers
  where listing_id = _listing_id and status <> 'withdrawn';
$$;

revoke execute on function public.request_offer_count(uuid) from public;
revoke execute on function public.listing_offer_count(uuid) from public;
grant execute on function public.request_offer_count(uuid) to anon, authenticated;
grant execute on function public.listing_offer_count(uuid) to anon, authenticated;

-- ============================================================================
-- 5. create_offer — crea la oferta, abre/reutiliza el chat y deja el mensaje.
--    Devuelve el id de la conversación (la UI navega al hilo).
-- ============================================================================
create or replace function public.create_offer(
  _listing_id   uuid,
  _request_id   uuid,
  _amount_cents integer,
  _message      text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _me       uuid := auth.uid();
  _to       uuid;
  _tier     public.subscription_plan;
  _conv     uuid;
  _body     text;
  _existing uuid;
begin
  if _me is null then
    raise exception 'Autenticación requerida';
  end if;
  if (_listing_id is not null) = (_request_id is not null) then
    raise exception 'Indica un anuncio o una petición, no ambos';
  end if;
  if _amount_cents is null or _amount_cents < 0 then
    raise exception 'Importe inválido';
  end if;

  if _listing_id is not null then
    -- Oferta sobre anuncio: sin gate, es el flujo básico del marketplace.
    select user_id into _to from public.listings where id = _listing_id;
    if _to is null then
      raise exception 'Anuncio no encontrado';
    end if;
    if _to = _me then
      raise exception 'No puedes ofertar sobre tu propio anuncio';
    end if;

    select id into _conv
    from public.conversations
    where listing_id = _listing_id and buyer_id = _me;

    if _conv is null then
      insert into public.conversations (listing_id, buyer_id, seller_id)
      values (_listing_id, _me, _to)
      returning id into _conv;
    end if;
  else
    -- Oferta sobre petición: reservada a PRO/Retail.
    select user_id into _to from public.requests where id = _request_id;
    if _to is null then
      raise exception 'Petición no encontrada';
    end if;
    if _to = _me then
      raise exception 'No puedes ofertar sobre tu propia petición';
    end if;

    select s.tier into _tier
    from public.subscriptions s
    where s.user_id = _me and s.status = 'active';

    if coalesce(_tier, 'free') not in ('pro', 'retail') then
      raise exception 'Responder a peticiones requiere plan PRO o Retail';
    end if;

    -- En una petición el autor es el comprador y quien oferta, el vendedor.
    select id into _conv
    from public.conversations
    where request_id = _request_id and seller_id = _me;

    if _conv is null then
      insert into public.conversations (request_id, buyer_id, seller_id)
      values (_request_id, _to, _me)
      returning id into _conv;
    end if;
  end if;

  _body := 'Oferta: ' || to_char(round(_amount_cents / 100.0, 2), 'FM999999990.00') || ' €';
  if _message is not null and btrim(_message) <> '' then
    _body := _body || E'\n' || btrim(_message);
  end if;

  -- kind='offer' para que la notificación de mensaje no duplique la de oferta.
  insert into public.messages (conversation_id, sender_id, body, kind)
  values (_conv, _me, _body, 'offer');

  -- Solo puede haber una oferta viva por persona y objetivo: si ya existe, se
  -- actualiza el importe (re-ofertar/negociar) en vez de descartarla en silencio.
  if _listing_id is not null then
    select id into _existing
    from public.offers
    where listing_id = _listing_id and from_user_id = _me and status = 'pending';
  else
    select id into _existing
    from public.offers
    where request_id = _request_id and from_user_id = _me and status = 'pending';
  end if;

  if _existing is not null then
    update public.offers
    set amount_cents    = _amount_cents,
        message         = nullif(btrim(_message), ''),
        conversation_id = _conv
    where id = _existing;
  else
    insert into public.offers (
      listing_id, request_id, from_user_id, to_user_id, conversation_id, amount_cents, message
    )
    values (_listing_id, _request_id, _me, _to, _conv, _amount_cents, nullif(btrim(_message), ''));
  end if;

  return _conv;
end;
$$;

revoke execute on function public.create_offer(uuid, uuid, integer, text) from public;
grant execute on function public.create_offer(uuid, uuid, integer, text) to authenticated;

-- ============================================================================
-- 6. respond_to_offer — aceptar/rechazar (destinatario) o retirar (emisor).
--    Aceptar una oferta sobre un anuncio lo marca como Reservado.
-- ============================================================================
create or replace function public.respond_to_offer(_offer_id uuid, _status public.offer_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _me  uuid := auth.uid();
  _row public.offers;
begin
  if _me is null then
    raise exception 'Autenticación requerida';
  end if;

  select * into _row from public.offers where id = _offer_id;
  if _row.id is null then
    raise exception 'Oferta no encontrada';
  end if;
  if _row.status <> 'pending' then
    raise exception 'Esta oferta ya está resuelta';
  end if;

  if _status in ('accepted', 'rejected') then
    if _me <> _row.to_user_id then
      raise exception 'Solo quien recibe la oferta puede aceptarla o rechazarla';
    end if;
  elsif _status = 'withdrawn' then
    if _me <> _row.from_user_id then
      raise exception 'Solo quien la envió puede retirarla';
    end if;
  else
    raise exception 'Estado inválido';
  end if;

  update public.offers set status = _status where id = _offer_id;

  -- Aceptar sobre un anuncio lo reserva.
  if _status = 'accepted' and _row.listing_id is not null then
    update public.listings set status = 'reserved' where id = _row.listing_id;
  end if;
end;
$$;

revoke execute on function public.respond_to_offer(uuid, public.offer_status) from public;
grant execute on function public.respond_to_offer(uuid, public.offer_status) to authenticated;

-- ============================================================================
-- 7. Notificaciones
-- ============================================================================

-- El mensaje de una oferta no genera notificación de "mensaje": ya la genera la oferta.
create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _recipient uuid;
  _link      text;
begin
  if new.kind = 'offer' then
    return new;
  end if;

  select case when new.sender_id = c.buyer_id then c.seller_id else c.buyer_id end
    into _recipient
  from public.conversations c
  where c.id = new.conversation_id;

  if _recipient is null then
    return new;
  end if;

  _link := '/mensajes/' || new.conversation_id;

  update public.notifications
  set created_at = now(), read_at = null, title = 'Nuevo mensaje', body = left(new.body, 80)
  where user_id = _recipient and type = 'message' and link = _link and read_at is null;

  if not found then
    insert into public.notifications (user_id, type, title, body, link)
    values (_recipient, 'message', 'Nuevo mensaje', left(new.body, 80), _link);
  end if;

  return new;
end;
$$;

-- Nueva oferta (o importe revisado) -> notifica al destinatario.
create or replace function public.notify_on_offer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _title text;
begin
  -- En UPDATE solo interesa si cambió el importe (re-oferta).
  if TG_OP = 'UPDATE' and new.amount_cents is not distinct from old.amount_cents then
    return new;
  end if;

  _title := case when TG_OP = 'INSERT' then 'Nueva oferta: ' else 'Oferta actualizada: ' end
         || to_char(round(new.amount_cents / 100.0, 2), 'FM999999990.00') || ' €';

  insert into public.notifications (user_id, type, title, body, link)
  values (
    new.to_user_id,
    'offer',
    _title,
    left(coalesce(new.message, ''), 80),
    '/mensajes/' || new.conversation_id
  );

  return new;
end;
$$;

drop trigger if exists offers_notify on public.offers;
create trigger offers_notify
  after insert or update of amount_cents on public.offers
  for each row execute function public.notify_on_offer();

-- Oferta resuelta -> avisa a quien la envió.
create or replace function public.notify_on_offer_resolved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status or new.status = 'withdrawn' then
    return new;
  end if;

  insert into public.notifications (user_id, type, title, link)
  values (
    new.from_user_id,
    'offer',
    case new.status
      when 'accepted' then 'Han aceptado tu oferta'
      when 'rejected' then 'Han rechazado tu oferta'
      else 'Tu oferta ha cambiado de estado'
    end,
    '/mensajes/' || new.conversation_id
  );

  return new;
end;
$$;

drop trigger if exists offers_notify_resolved on public.offers;
create trigger offers_notify_resolved
  after update of status on public.offers
  for each row execute function public.notify_on_offer_resolved();
