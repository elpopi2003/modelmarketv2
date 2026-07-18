-- ModelMarket · Seguridad — Retirar a `anon` el EXECUTE de funciones privadas.
--
-- Detectado con el linter de Supabase: `anon` podía ejecutar las funciones de
-- administración y las de acciones autenticadas, pese a los `revoke ... from public`
-- de las migraciones anteriores.
--
-- Causa: Supabase concede EXECUTE a `anon` de forma EXPLÍCITA (no vía PUBLIC), así que
-- revocar de `public` no la retira. Hay que revocar de `anon` por nombre.
--
-- No era explotable —todas comprueban `has_role` o `auth.uid()` por dentro y rechazan a
-- un anónimo— pero la barrera de permisos no era la que se pretendía. Defensa en
-- profundidad: si algún día una de estas funciones olvidara su comprobación interna,
-- el GRANT sería lo único que quedaría.
--
-- NO se tocan (deben seguir siendo ejecutables por anon):
--   * has_role e is_conversation_participant → las invocan las POLÍTICAS RLS al evaluar
--     el acceso público. Revocarlas dejaría el catálogo invisible para los visitantes.
--   * increment_listing_views → las visitas se cuentan también sin sesión.
--   * listing_favorite_count, listing_offer_count, request_offer_count → contadores
--     públicos por diseño.
--
-- Las funciones de trigger (notify_*, handle_new_user, bump_conversation_on_message)
-- se dejan como están: PostgreSQL no comprueba EXECUTE al dispararse un trigger, y
-- llamarlas directamente falla ("trigger functions can only be called as triggers").

revoke execute on function public.admin_stats() from anon;
revoke execute on function public.admin_users() from anon;
revoke execute on function public.admin_set_admin(uuid, boolean) from anon;
revoke execute on function public.admin_take_down(text, uuid) from anon;
revoke execute on function public.admin_restore(text, uuid) from anon;

revoke execute on function public.create_offer(uuid, uuid, integer, text) from anon;
revoke execute on function public.respond_to_offer(uuid, public.offer_status) from anon;
revoke execute on function public.get_or_create_conversation(uuid) from anon;
revoke execute on function public.mark_conversation_read(uuid) from anon;
revoke execute on function public.unread_message_count() from anon;
revoke execute on function public.unread_notification_count() from anon;
revoke execute on function public.get_or_create_brand(text) from anon;
