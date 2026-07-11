-- ModelMarket · M4 — Mensajería (conversations + messages).
-- Soft-delete por participante en la conversación. La creación, el contador de no leídos
-- y el marcado de leído van por RPC SECURITY DEFINER.

-- ============================================================================
-- conversations  (hilo entre comprador y vendedor sobre un anuncio)
-- ============================================================================
create table if not exists public.conversations (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null references public.listings (id) on delete cascade,
  buyer_id         uuid not null references auth.users (id) on delete cascade,
  seller_id        uuid not null references auth.users (id) on delete cascade,
  buyer_deleted_at  timestamptz,
  seller_deleted_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);

create index if not exists conversations_buyer_idx on public.conversations (buyer_id);
create index if not exists conversations_seller_idx on public.conversations (seller_id);
create index if not exists conversations_updated_idx on public.conversations (updated_at desc);

grant select, update on public.conversations to authenticated;

alter table public.conversations enable row level security;

-- Solo los participantes ven / gestionan (soft-delete) su conversación.
create policy "conversations_select_participant"
  on public.conversations
  for select
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "conversations_update_participant"
  on public.conversations
  for update
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id)
  with check (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Helper: ¿es el usuario participante de la conversación? (SECURITY DEFINER: evita
-- recursión de RLS al usarlo en las policies de messages).
create or replace function public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = _conversation_id
      and (_user_id = c.buyer_id or _user_id = c.seller_id)
  );
$$;

-- ============================================================================
-- messages
-- ============================================================================
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references auth.users (id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 4000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

grant select, insert on public.messages to authenticated;

alter table public.messages enable row level security;

create policy "messages_select_participant"
  on public.messages
  for select
  to authenticated
  using (public.is_conversation_participant(conversation_id, auth.uid()));

create policy "messages_insert_participant"
  on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and public.is_conversation_participant(conversation_id, auth.uid())
  );

-- Al insertar un mensaje: sube updated_at y reaparece la conversación para ambos
-- (limpia el soft-delete).
create or replace function public.bump_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now(),
      buyer_deleted_at = null,
      seller_deleted_at = null
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_bump_conversation on public.messages;
create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation_on_message();

-- ============================================================================
-- RPCs
-- ============================================================================

-- Encuentra o crea la conversación del comprador (auth.uid()) para un anuncio.
create or replace function public.get_or_create_conversation(_listing_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _buyer  uuid := auth.uid();
  _seller uuid;
  _conv   uuid;
begin
  if _buyer is null then
    raise exception 'Autenticación requerida';
  end if;

  select user_id into _seller from public.listings where id = _listing_id;
  if _seller is null then
    raise exception 'Anuncio no encontrado';
  end if;
  if _seller = _buyer then
    raise exception 'No puedes contactarte a ti mismo';
  end if;

  select id into _conv
  from public.conversations
  where listing_id = _listing_id and buyer_id = _buyer;

  if _conv is null then
    insert into public.conversations (listing_id, buyer_id, seller_id)
    values (_listing_id, _buyer, _seller)
    returning id into _conv;
  end if;

  return _conv;
end;
$$;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- Total de mensajes no leídos del usuario actual.
create or replace function public.unread_message_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.read_at is null
    and m.sender_id <> auth.uid()
    and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id);
$$;

grant execute on function public.unread_message_count() to authenticated;

-- Marca como leídos los mensajes recibidos en una conversación.
create or replace function public.mark_conversation_read(_conversation_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.messages
  set read_at = now()
  where conversation_id = _conversation_id
    and sender_id <> auth.uid()
    and read_at is null
    and public.is_conversation_participant(_conversation_id, auth.uid());
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;
