-- ModelMarket · Los administradores pueden eliminar peticiones definitivamente.
--
-- Hasta ahora solo podía borrarlas su autor (requests_delete_own), así que desde el panel
-- de moderación no había forma de sacar contenido de la plataforma de verdad: solo
-- retirarlo, que lo oculta pero lo conserva.
--
-- Ojo con el alcance: el borrado arrastra en cascada conversaciones, mensajes, ofertas y
-- REPORTES asociados a la petición (ver las FK con on delete cascade). Perder el reporte
-- significa perder el rastro de por qué se moderó, así que en la interfaz esto solo se
-- ofrece sobre peticiones YA retiradas y con confirmación en dos pasos: retirar es
-- reversible, esto no.

drop policy if exists "requests_delete_own" on public.requests;
create policy "requests_delete_own"
  on public.requests
  for delete
  to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
