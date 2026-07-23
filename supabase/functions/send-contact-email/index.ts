// send-contact-email — formulario de contacto público.
//
// Verifica reCAPTCHA v3 en el SERVIDOR: un token generado en el cliente no prueba nada
// por sí mismo. Si RECAPTCHA_SECRET_KEY no está configurada, el envío se permite sin
// verificar y se deja aviso en los logs; así el formulario funciona antes de tener las
// claves y la protección se activa sola al añadirlas.
//
// El email se envía a CONTACT_EMAIL con reply_to al remitente, para poder responderle
// directamente desde el buzón.
//
// Secretos: RESEND_API_KEY, EMAIL_FROM, CONTACT_EMAIL, RECAPTCHA_SECRET_KEY (opcional).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const ok = (data: unknown) =>
  new Response(JSON.stringify({ ok: true, data, error: null }), { headers: jsonHeaders })
const fail = (error: string, status = 400) =>
  new Response(JSON.stringify({ ok: false, data: null, error }), { status, headers: jsonHeaders })

/** Escapa el texto del usuario antes de incrustarlo en el HTML del email. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Verifica el token contra Google. Devuelve true si no hay secreto configurado. */
async function verifyRecaptcha(token: string | null): Promise<{ okToSend: boolean; reason?: string }> {
  const secret = Deno.env.get('RECAPTCHA_SECRET_KEY')
  if (!secret) {
    console.warn('[send-contact-email] RECAPTCHA_SECRET_KEY sin configurar: envío sin verificar')
    return { okToSend: true }
  }
  if (!token) return { okToSend: false, reason: 'Falta la verificación anti-spam' }

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }),
  })
  const data = await res.json()

  // v3 devuelve una puntuación 0..1. Por debajo de 0.5 se considera probable bot.
  if (!data.success) return { okToSend: false, reason: 'Verificación anti-spam fallida' }
  if (typeof data.score === 'number' && data.score < 0.5) {
    return { okToSend: false, reason: 'Verificación anti-spam fallida' }
  }
  return { okToSend: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail('Método no permitido', 405)

  try {
    const body = await req.json().catch(() => null)
    const name = String(body?.name ?? '').trim()
    const email = String(body?.email ?? '').trim()
    const subject = String(body?.subject ?? '').trim()
    const message = String(body?.message ?? '').trim()
    const recaptchaToken = body?.recaptchaToken ?? null

    if (!name || !email || !subject || !message) {
      return fail('Faltan campos obligatorios')
    }
    if (message.length > 2000 || subject.length > 120 || name.length > 80 || email.length > 120) {
      return fail('Algún campo excede la longitud permitida')
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail('Email no válido')
    }

    const check = await verifyRecaptcha(recaptchaToken)
    if (!check.okToSend) return fail(check.reason ?? 'Verificación fallida', 403)

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) return fail('Falta el secreto RESEND_API_KEY', 500)
    const from = Deno.env.get('EMAIL_FROM') ?? 'ModelMarket <onboarding@resend.dev>'
    const to = Deno.env.get('CONTACT_EMAIL') ?? 'info@modelmarket.es'

    const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#F4F6F9;padding:24px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:2px solid #E1E7EF;border-radius:6px;overflow:hidden;">
      <div style="background:#ffffff;padding:20px 24px 16px;border-bottom:3px solid #F7941D;">
        <img src="https://shanozqxmmdiqvqhffbz.supabase.co/storage/v1/object/public/brand/logo.png" alt="ModelMarket" width="220"
             style="display:block;border:0;outline:none;text-decoration:none;width:220px;max-width:100%;height:auto;" />
      </div>
      <div style="padding:24px;">
        <h1 style="margin:0 0 12px;color:#1B3A5F;font-size:20px;">Nuevo mensaje del formulario de contacto</h1>
        <p style="margin:0 0 8px;color:#1A2733;font-size:15px;"><strong>De:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
        <p style="margin:0 0 14px;color:#1A2733;font-size:15px;"><strong>Asunto:</strong> ${escapeHtml(subject)}</p>
        <div style="border-top:1px solid #E1E7EF;padding-top:14px;color:#1A2733;font-size:15px;line-height:1.6;white-space:pre-line;">${escapeHtml(message)}</div>
        <p style="margin:18px 0 0;color:#5B6B7B;font-size:12px;">Responde a este email para contestar directamente al remitente.</p>
      </div>
    </div>
  </body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `Contacto: ${subject}`,
        html,
        reply_to: email,
      }),
    })
    if (!res.ok) return fail(`Resend ${res.status}: ${await res.text()}`, 502)

    const data = await res.json()
    return ok({ id: data.id })
  } catch (e) {
    console.error('[send-contact-email]', e)
    return fail(String(e), 500)
  }
})
