-- ModelMarket · Los anuncios reservados siguen siendo públicos.
--
-- Al introducir el estado 'reserved' (ver 20260716120000), la policy de lectura pública
-- seguía exponiendo solo 'active': aceptar una oferta hacía DESAPARECER el anuncio del
-- catálogo y de su propia ficha para todo el mundo salvo su dueño.
--
-- Un anuncio reservado debe verse (con su lazo "Reservado"): informa de que ya hay trato
-- pero el contenido sigue siendo público. 'sold' / 'archived' / 'draft' siguen ocultos.

drop policy if exists "listings_select_public" on public.listings;
create policy "listings_select_public"
  on public.listings
  for select
  using (
    (status in ('active', 'reserved') and visible_at <= now())
    or auth.uid() = user_id
  );
