import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import nodemailer from 'nodemailer'
import type { Config } from '../config'

export interface OutgoingEmail {
  from: string
  to: string
  replyTo?: string | null
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}

/** Algo capaz de entregar un email. Lanza si no lo consigue (la cola reintentará). */
export interface MailTransport {
  send(email: OutgoingEmail): Promise<void>
}

const toMessage = (e: OutgoingEmail) => ({
  from: e.from,
  to: e.to,
  replyTo: e.replyTo ?? undefined,
  subject: e.subject,
  html: e.html,
  text: e.text,
  headers: e.headers,
})

/**
 * Entrega por el comando `sendmail` del VPS (el mismo camino que usan PHP y Plesk).
 *
 * Es el transporte de producción en Plesk: su Postfix rechaza el SMTP sin autenticar
 * incluso desde 127.0.0.1 ("Relay access denied"), mientras que `sendmail` deja el correo
 * en la cola local sin necesitar la contraseña de ningún buzón, y Plesk lo firma con DKIM.
 * `-f` (remitente del sobre) lo pone nodemailer a partir de `from`.
 */
export function sendmailTransport(path: string): MailTransport {
  const t = nodemailer.createTransport({ sendmail: true, newline: 'unix', path })
  return {
    async send(email) {
      await t.sendMail(toMessage(email))
    },
  }
}

/**
 * Entrega por SMTP sin autenticar a un Postfix que lo permita. Sin TLS a propósito: la conexión es por loopback
 * (127.0.0.1) y el certificado del servidor de correo no está emitido para "localhost",
 * así que STARTTLS fallaría la verificación sin aportar nada. Postfix se encarga de
 * firmar con DKIM y de usar TLS hacia los servidores de destino.
 */
export function smtpTransport(config: Pick<Config, 'SMTP_HOST' | 'SMTP_PORT'>): MailTransport {
  const t = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: false,
    ignoreTLS: true,
  })
  return {
    async send(email) {
      await t.sendMail(toMessage(email))
    },
  }
}

/**
 * Desarrollo: en lugar de enviar, guarda cada email en `dir` como `.eml` (se abre con
 * Outlook/Thunderbird) y `.html` (se abre en el navegador). Nunca escribe a nadie.
 */
export function fileTransport(dir: string): MailTransport {
  const t = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' })
  return {
    async send(email) {
      await mkdir(dir, { recursive: true })
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const safeTo = email.to.replace(/[^a-z0-9@._-]/gi, '_')
      const base = join(dir, `${stamp}_${safeTo}`)
      const info = await t.sendMail(toMessage(email))
      await writeFile(`${base}.eml`, info.message as Buffer)
      await writeFile(`${base}.html`, email.html, 'utf8')
    },
  }
}

export function createTransport(config: Config): MailTransport {
  switch (config.MAIL_TRANSPORT) {
    case 'sendmail':
      return sendmailTransport(config.SENDMAIL_PATH)
    case 'smtp':
      return smtpTransport(config)
    case 'file':
      return fileTransport(config.MAIL_FILE_DIR)
  }
}

/** Para tests: guarda los emails en memoria. */
export function memoryTransport(): MailTransport & { sent: OutgoingEmail[]; failNext: number } {
  const state = {
    sent: [] as OutgoingEmail[],
    failNext: 0,
    async send(email: OutgoingEmail) {
      if (state.failNext > 0) {
        state.failNext--
        throw new Error('fallo simulado del servidor de correo')
      }
      state.sent.push(email)
    },
  }
  return state
}
