-- ModelMarket · Peticiones — estados aceptados, calcas y urgencia (paridad con staging).
--
-- Tres campos que el modal del staging muestra y nuestro modelo no tenía:
--   * accepted_conditions: qué estados del artículo acepta el autor (multi-selección
--     sobre la MISMA taxonomía del anuncio: sealed/opened/started). Array, no enum nuevo.
--   * decals_requirement: requisito de calcas. Espeja los valores del anuncio más
--     'any' ("No importante"). Es un requisito del autor, no un estado del artículo,
--     por eso es un tipo propio y no reutiliza decals_status.
--   * urgency: sin prisa / normal / urgente.
--
-- Defaults pensados para las filas existentes: "acepto cualquier estado, calcas no
-- importantes, sin prisa" — lo menos restrictivo, que es lo que esas peticiones
-- significaban cuando no existían los campos.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'decals_requirement') then
    create type public.decals_requirement as enum ('any', 'perfect', 'yellowed', 'unavailable');
  end if;
  if not exists (select 1 from pg_type where typname = 'request_urgency') then
    create type public.request_urgency as enum ('no_rush', 'normal', 'urgent');
  end if;
end $$;

alter table public.requests
  add column if not exists accepted_conditions public.listing_condition[] not null
    default '{sealed,opened,started}',
  add column if not exists decals_requirement public.decals_requirement not null default 'any',
  add column if not exists urgency public.request_urgency not null default 'no_rush';

-- Al menos un estado aceptado: una petición que no acepta ninguno no tiene sentido.
alter table public.requests
  drop constraint if exists requests_accepted_conditions_check;
alter table public.requests
  add constraint requests_accepted_conditions_check
  check (array_length(accepted_conditions, 1) >= 1);
