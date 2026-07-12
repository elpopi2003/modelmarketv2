// Notifica por email al receptor de un mensaje nuevo.
// Ejemplo de función de notificación "real" que consume la capa _shared.
// Payload: { to, senderName, listingTitle, conversationId }

import { corsHeaders } from '../_shared/cors.ts'
import { ok, fail } from '../_shared/response.ts'
import { sendEmail } from '../_shared/resend.ts'
import { newMessageEmail } from '../_shared/email-templates.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail('Método no permitido', 405)

  try {
    const { to, senderName, listingTitle, conversationId } = await req.json().catch(() => ({}))
    if (!to || !senderName || !listingTitle || !conversationId) {
      return fail('Faltan campos: to, senderName, listingTitle, conversationId')
    }

    const { subject, html } = newMessageEmail({
      recipientName: to,
      senderName,
      listingTitle,
      conversationId,
    })
    const { id } = await sendEmail({ to, subject, html })

    return ok({ id })
  } catch (e) {
    return fail(String(e), 500)
  }
})
