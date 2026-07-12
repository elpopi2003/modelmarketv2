-- ModelMarket · M4 — Notificaciones.
-- Se generan server-side por triggers (SECURITY DEFINER). El usuario solo lee / marca /
-- borra las suyas; no las inserta.

-- ============================================================================
-- notifications
-- ============================================================================
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null, -- 'message' | 'favorite' | (extensible)
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id, read_at);

grant select, update, delete on public.notifications to authenticated;

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "notifications_update_own"
  on public.notifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notifications_delete_own"
  on public.notifications
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Contador de no leídas del usuario actual (para la campanita).
create or replace function public.unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.notifications
  where user_id = auth.uid() and read_at is null;
$$;

grant execute on function public.unread_notification_count() to authenticated;

-- ============================================================================
-- Triggers generadores
-- ============================================================================

-- Nuevo mensaje -> notifica al otro participante (dedup: una notif no leída por conversación).
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

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_on_message();

-- Anuncio favoriteado -> notifica al dueño (salvo que se favoritee a sí mismo).
create or replace function public.notify_on_favorite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _owner uuid;
begin
  select user_id into _owner from public.listings where id = new.listing_id;

  if _owner is not null and _owner <> new.user_id then
    insert into public.notifications (user_id, type, title, link)
    values (_owner, 'favorite', 'Han guardado tu anuncio', '/producto/' || new.listing_id);
  end if;

  return new;
end;
$$;

drop trigger if exists favorites_notify on public.favorites;
create trigger favorites_notify
  after insert on public.favorites
  for each row execute function public.notify_on_favorite();
