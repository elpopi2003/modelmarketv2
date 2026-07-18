// admin-delete-user — elimina la cuenta de OTRO usuario. Solo administradores.
//
// Comprueba el rol en la BD (has_role) con el JWT de quien llama, no se fía del cliente.
// El borrado de auth.users cascada sobre su contenido (mismo efecto que delete-account).
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

    // El rol se comprueba en la BD, con la sesión de quien llama.
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    })
    if (roleError) return fail(roleError.message, 500)
    if (!isAdmin) return fail('Solo administradores', 403)

    const body = await req.json().catch(() => null)
    const targetId = body?.userId as string | undefined
    if (!targetId) return fail('Falta userId', 400)
    if (targetId === user.id) {
      return fail('Usa Configuración para eliminar tu propia cuenta', 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { error } = await admin.auth.admin.deleteUser(targetId)
    if (error) return fail(error.message, 500)

    return ok({ deleted: targetId })
  } catch (e) {
    return fail(String(e), 500)
  }
})
