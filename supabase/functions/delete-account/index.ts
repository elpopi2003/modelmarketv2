// delete-account — elimina la cuenta del usuario autenticado.
// El borrado de auth.users cascada sobre profiles, listings, requests, offers,
// conversations, messages, favorites, notifications y subscriptions (FK on delete
// cascade). Los ficheros de storage quedan huérfanos (no visibles sin sus URLs);
// limpieza programada pendiente para M6.
// Autenticada. Respuesta homogénea { ok, data, error }.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { corsHeaders } from '../_shared/cors.ts'
import { fail, ok } from '../_shared/response.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return fail('No autorizado', 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail('No autorizado', 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) return fail(error.message, 500)

    return ok({ deleted: true })
  } catch (e) {
    return fail(String(e), 500)
  }
})
