-- ModelMarket · «Acepta ofertas» en los anuncios.
--
-- Significa que el vendedor está abierto a recibir ofertas POR DEBAJO del precio
-- publicado. Sin marcar, el anuncio sigue admitiendo ofertas, pero solo por el precio
-- expuesto: quien vende no quiere que le regateen.
--
-- Por defecto true, para no cambiar el comportamiento de los anuncios ya publicados.
--
-- La regla se aplica dentro de create_offer, no solo en el formulario: si viviera
-- únicamente en la interfaz, bastaría con llamar a la API para saltársela.

alter table public.listings
  add column if not exists accepts_offers boolean not null default true;

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
  _price    integer;
  _accepts  boolean;
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
    select user_id, price_cents, accepts_offers
      into _to, _price, _accepts
      from public.listings where id = _listing_id;

    if _to is null then
      raise exception 'Anuncio no encontrado';
    end if;
    if _to = _me then
      raise exception 'No puedes ofertar sobre tu propio anuncio';
    end if;

    -- Si no acepta regateo, solo se admite el precio publicado (o más).
    if not _accepts and _amount_cents < _price then
      raise exception 'Este vendedor no acepta ofertas por debajo del precio publicado';
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

  insert into public.messages (conversation_id, sender_id, body, kind)
  values (_conv, _me, _body, 'offer');

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
