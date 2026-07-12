-- ModelMarket · M5 — Suscripciones.
-- La fuente de verdad la escribe el webhook de Stripe (service_role, que salta RLS).
-- El cliente solo LEE su propia suscripción; el tier público (para insignias) va por vista.

-- ============================================================================
-- Enum de plan
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_plan') then
    create type public.subscription_plan as enum ('free', 'pro', 'retail');
  end if;
end $$;

-- ============================================================================
-- subscriptions  (una por usuario)
-- ============================================================================
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references auth.users (id) on delete cascade,
  tier                   public.subscription_plan not null default 'free',
  status                 text not null default 'active', -- estado Stripe: active, trialing, canceled, past_due…
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

-- Solo lectura de la propia (contiene ids de Stripe = sensibles). Escritura: webhook/service_role.
grant select on public.subscriptions to authenticated;

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own"
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Vista pública: solo campos seguros (tier/status). NUNCA expone stripe_customer_id
-- ni stripe_subscription_id. Sirve para mostrar insignias PRO de otros usuarios.
-- ============================================================================
create or replace view public.subscriptions_public as
  select user_id, tier, status
  from public.subscriptions;

grant select on public.subscriptions_public to anon, authenticated;
