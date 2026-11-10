import type { Config } from './config'
import type { Db } from './db/client'
import { enqueueEmail } from './email/outbox'
import { contactEmail } from './email/templates/account'
import { HttpError } from './http/reply'

export interface ContactInput {
  name: string
  email: string
  subject: string
  message: string
  recaptchaToken?: string | null
}

/**
 * Comprueba el token de reCAPTCHA v3 con Google. Sin clave secreta configurada se deja
 * pasar (desarrollo); en producción debe estar puesta. v3 da una puntuación 0..1: por
 * debajo del mínimo se trata como probable bot.
 */
export async function verifyRecaptcha(
  config: Pick<Config, 'RECAPTCHA_SECRET' | 'RECAPTCHA_MIN_SCORE'>,
  token: string | null | undefined,
  ip?: string,
  log?: { warn: (msg: string) => void },
) {
  if (!config.RECAPTCHA_SECRET) {
    log?.warn('RECAPTCHA_SECRET sin configurar: formulario de contacto sin verificar')
    return
  }
  const rejected = () =>
    new HttpError(
      403,
      'recaptcha_failed',
      'No hemos podido verificar que no eres un robot. Recarga la página e inténtalo de nuevo.',
    )
  if (!token) throw rejected()
  let data: { success?: boolean; score?: number }
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: config.RECAPTCHA_SECRET,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    })
    data = (await res.json()) as typeof data
  } catch {
    throw new HttpError(
      503,
      'recaptcha_unavailable',
      'La verificación anti-spam no responde. Inténtalo en unos minutos.',
    )
  }
  if (!data.success) throw rejected()
  if (typeof data.score === 'number' && data.score < config.RECAPTCHA_MIN_SCORE) throw rejected()
}

/** Formulario de contacto: verifica reCAPTCHA y deja el mensaje en la cola hacia el buzón. */
export async function sendContact(
  db: Db,
  config: Config,
  input: ContactInput,
  ip?: string,
  log?: { warn: (msg: string) => void },
) {
  await verifyRecaptcha(config, input.recaptchaToken, ip, log)
  await enqueueEmail(db, {
    to: config.CONTACT_EMAIL,
    kind: 'contact',
    content: contactEmail(input, { appUrl: config.APP_URL, logoUrl: config.MAIL_LOGO_URL }),
    // Responder al email contesta directamente a quien escribió.
    replyTo: input.email,
  })
}
