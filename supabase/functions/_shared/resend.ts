const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}

/**
 * Envía un email vía la API de Resend (sin dependencias: fetch directo).
 * Lee `RESEND_API_KEY` y `EMAIL_FROM` de las variables de entorno (secretos).
 */
export async function sendEmail({ to, subject, html, replyTo }: SendEmailInput): Promise<{ id: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('EMAIL_FROM') ?? 'ModelMarket <onboarding@resend.dev>'
  if (!apiKey) throw new Error('Falta el secreto RESEND_API_KEY')

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html, reply_to: replyTo }),
  })

  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`)
  }
  return await res.json()
}
