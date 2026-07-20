// admin-suspend-user — suspende o reactiva la cuenta de otro usuario. Solo administradores.
//
// El bloqueo real es un BANEO en el sistema de autenticación (`ban_duration`), no una
// comprobación en el código de la aplicación: así no depende de que cada pantalla se
// acuerde de mirarlo, y no se puede sortear llamando a la API a mano.
//
// La fila en `user_suspensions` es el registro que consulta la aplicación; su existencia
// es además lo que oculta los anuncios y peticiones del usuario (ver `is_suspended`).
//
// Orden deliberado: primero la fila, después el baneo, y si el baneo falla se deshace la
// fila. Al revés se podría quedar alguien bloqueado sin constancia de por qué.
//
// El email es lo último y NO revierte nada si falla: dejar a medias una suspensión porque
// el correo no salió sería peor. Se informa con `emailSent` para poder avisar al admin.
//
// Secretos: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
// EMAIL_FROM, APP_URL.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { corsHeaders } from '../_shared/cors.ts'
import { fail, ok } from '../_shared/response.ts'
import { sendEmail } from '../_shared/resend.ts'
import { reinstatementEmail, suspensionEmail } from '../_shared/moderation-emails.ts'

/** ~100 años. La suspensión es indefinida: se levanta a mano, no caduca sola. */
const BAN_FOREVER = '876000h'

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

    // El rol se comprueba en la BD, con la sesión de quien llama. No se fía del cliente.
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    })
    if (roleError) return fail(roleError.message, 500)
    if (!isAdmin) return fail('Solo administradores', 403)

    const body = await req.json().catch(() => null)
    const targetId = body?.userId as string | undefined
    const action = body?.action as 'suspend' | 'unsuspend' | undefined
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

    if (!targetId) return fail('Falta userId', 400)
    if (action !== 'suspend' && action !== 'unsuspend') {
      return fail('action debe ser "suspend" o "unsuspend"', 400)
    }
    if (targetId === user.id) return fail('No puedes suspenderte a ti mismo', 400)
    if (action === 'suspend' && !reason) {
      return fail('Hace falta un motivo: se le envía a la persona por email', 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Suspender a otro administrador queda bloqueado: si solo hubiera uno, o si se
    // suspenden en cadena, nadie podría volver a entrar para levantarlo.
    const { data: targetIsAdmin } = await admin.rpc('has_role', {
      _user_id: targetId,
      _role: 'admin',
    })
    if (targetIsAdmin && action === 'suspend') {
      return fail('No se puede suspender a un administrador: quítale antes el rol', 400)
    }

    const { data: targetUser, error: targetError } = await admin.auth.admin.getUserById(targetId)
    if (targetError || !targetUser?.user) return fail('Ese usuario no existe', 404)
    const email = targetUser.user.email
    const { data: profile } = await admin
      .from('profiles')
      .select('display_name, username')
      .eq('id', targetId)
      .maybeSingle()
    const name = profile?.display_name || profile?.username || 'coleccionista'

    if (action === 'suspend') {
      const { error: insertError } = await admin
        .from('user_suspensions')
        .upsert(
          { user_id: targetId, reason, suspended_by: user.id, suspended_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        )
      if (insertError) return fail(insertError.message, 500)

      const { error: banError } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: BAN_FOREVER,
      })
      if (banError) {
        // Sin baneo no hay suspensión real: se deshace el registro para no dejar a alguien
        // con el contenido oculto pero pudiendo entrar como si nada.
        await admin.from('user_suspensions').delete().eq('user_id', targetId)
        return fail(`No se pudo bloquear el acceso, no se ha suspendido: ${banError.message}`, 502)
      }

      let emailSent = false
      let emailError: string | null = null
      if (email) {
        try {
          const { subject, html } = suspensionEmail(name, reason)
          await sendEmail({ to: email, subject, html })
          emailSent = true
        } catch (e) {
          emailError = String(e)
        }
      }
      return ok({ userId: targetId, suspended: true, emailSent, emailError })
    }

    // Reactivar: primero se quita el registro, después el baneo. Si fallara el segundo
    // paso la persona sigue sin poder entrar, que es el lado seguro del error.
    const { error: deleteError } = await admin
      .from('user_suspensions')
      .delete()
      .eq('user_id', targetId)
    if (deleteError) return fail(deleteError.message, 500)

    const { error: unbanError } = await admin.auth.admin.updateUserById(targetId, {
      ban_duration: 'none',
    })
    if (unbanError) {
      return fail(
        `Se quitó el registro de suspensión pero no se pudo desbloquear el acceso. Vuelve a intentarlo. (${unbanError.message})`,
        502,
      )
    }

    let emailSent = false
    let emailError: string | null = null
    if (email) {
      try {
        const { subject, html } = reinstatementEmail(name)
        await sendEmail({ to: email, subject, html })
        emailSent = true
      } catch (e) {
        emailError = String(e)
      }
    }
    return ok({ userId: targetId, suspended: false, emailSent, emailError })
  } catch (e) {
    return fail(String(e), 500)
  }
})
