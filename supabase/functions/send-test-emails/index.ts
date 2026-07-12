// Envía un ejemplo de CADA tipo de notificación por email a una dirección dada.
// Uso: POST { "to": "alf.mosquera@gmail.com" } con la cabecera x-test-secret.
//
// Protegida por el secreto EMAIL_TEST_SECRET para que no sea un enviador abierto.
// Despliega con: supabase functions deploy send-test-emails --no-verify-jwt

import { corsHeaders } from '../_shared/cors.ts'
import { ok, fail } from '../_shared/response.ts'
import { sendEmail } from '../_shared/resend.ts'
import { allSampleEmails } from '../_shared/email-templates.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail('Método no permitido', 405)

  try {
    const secret = Deno.env.get('EMAIL_TEST_SECRET')
    if (secret && req.headers.get('x-test-secret') !== secret) {
      return fail('No autorizado', 401)
    }

    const { to } = await req.json().catch(() => ({}))
    if (!to || typeof to !== 'string') return fail('Falta el campo "to" (email destino)')

    const samples = allSampleEmails()
    const results: { type: string; sent: boolean; id?: string; error?: string }[] = []

    for (const sample of samples) {
      try {
        const { id } = await sendEmail({
          to,
          subject: `[TEST] ${sample.subject}`,
          html: sample.html,
        })
        results.push({ type: sample.type, sent: true, id })
      } catch (e) {
        results.push({ type: sample.type, sent: false, error: String(e) })
      }
    }

    const sent = results.filter((r) => r.sent).length
    return ok({ to, total: samples.length, sent, results })
  } catch (e) {
    return fail(String(e), 500)
  }
})
