-- ModelMarket · Seguridad — Completar el cierre de EXECUTE a `anon` (2ª pasada).
--
-- La migración anterior (20260720120000) revocó de `anon` y funcionó en las funciones
-- cuyas migraciones originales ya hacían `revoke ... from public`. En estas cuatro no,
-- porque solo tenían `grant ... to authenticated`: conservaban la concesión a PUBLIC
-- (visible en proacl como `=X/postgres`), y `anon` pertenece a PUBLIC, así que seguía
-- pudiendo ejecutarlas.
--
-- Lección: `revoke ... from anon` NO basta si queda una concesión a PUBLIC. Hay que
-- revocar de PUBLIC y volver a conceder explícitamente a quien deba tenerlo.

revoke execute on function public.get_or_create_conversation(uuid) from public;
revoke execute on function public.mark_conversation_read(uuid) from public;
revoke execute on function public.unread_message_count() from public;
revoke execute on function public.unread_notification_count() from public;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.unread_message_count() to authenticated;
grant execute on function public.unread_notification_count() to authenticated;
