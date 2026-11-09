import { randomUUID } from 'node:crypto'
import { sql, type Kysely } from 'kysely'
import type { Database } from '../db/schema'
import type { EmailContent } from './layout'
import type { MailTransport } from './transport'

/** Reintentos: tras el intento N se espera RETRY_DELAYS_MIN[N-1] minutos. */
const RETRY_DELAYS_MIN = [1, 5, 15, 60, 240]
export const MAX_ATTEMPTS = RETRY_DELAYS_MIN.length + 1
/** Un envío marcado 'sending' más tiempo que esto se da por interrumpido (reinicio). */
const STUCK_AFTER_MIN = 10

export interface EnqueueInput {
  to: string
  content: EmailContent
  kind: string
  replyTo?: string | null
  headers?: Record<string, string>
}

/**
 * Deja un email en la cola. Acepta una transacción para que el email exista solo si la
 * acción que lo provoca se confirma (y no se envíe si se deshace).
 */
export async function enqueueEmail(db: Kysely<Database>, input: EnqueueInput): Promise<string> {
  const id = randomUUID()
  await db
    .insertInto('email_outbox')
    .values({
      id,
      to_email: input.to,
      subject: input.content.subject,
      html: input.content.html,
      text: input.content.text,
      reply_to: input.replyTo ?? null,
      headers: input.headers ? JSON.stringify(input.headers) : null,
      kind: input.kind,
      last_error: null,
      sent_at: null,
    })
    .execute()
  return id
}

export interface ProcessOptions {
  transport: MailTransport
  from: string
  defaultReplyTo: string
  batchSize?: number
  log?: { error: (obj: object, msg: string) => void }
}

/**
 * Procesa un lote de la cola. Seguro con varios procesos a la vez (Passenger puede
 * arrancar más de uno): cada fila se reserva con `FOR UPDATE SKIP LOCKED` y se marca
 * 'sending' antes de soltar el bloqueo, así que dos procesos nunca envían la misma.
 *
 * Devuelve cuántos se enviaron y cuántos fallaron en este lote.
 */
export async function processOutbox(db: Kysely<Database>, opts: ProcessOptions) {
  // Rescata envíos que se quedaron a medias por un reinicio del servidor.
  await db
    .updateTable('email_outbox')
    .set({ status: 'pending' })
    .where('status', '=', 'sending')
    .where('send_after', '<', sql<Date>`NOW(3) - INTERVAL ${STUCK_AFTER_MIN} MINUTE`)
    .execute()

  const claimed = await db.transaction().execute(async (trx) => {
    const rows = await trx
      .selectFrom('email_outbox')
      .selectAll()
      .where('status', '=', 'pending')
      .where('send_after', '<=', sql<Date>`NOW(3)`)
      .orderBy('created_at')
      .limit(opts.batchSize ?? 20)
      .forUpdate()
      .skipLocked()
      .execute()
    if (rows.length) {
      await trx
        .updateTable('email_outbox')
        .set({ status: 'sending', send_after: sql<Date>`NOW(3)` })
        .where(
          'id',
          'in',
          rows.map((r) => r.id),
        )
        .execute()
    }
    return rows
  })

  let sent = 0
  let failed = 0
  for (const row of claimed) {
    try {
      await opts.transport.send({
        from: opts.from,
        to: row.to_email,
        replyTo: row.reply_to ?? opts.defaultReplyTo,
        subject: row.subject,
        html: row.html,
        text: row.text,
        headers: parseHeaders(row.headers),
      })
      await db
        .updateTable('email_outbox')
        .set({
          status: 'sent',
          sent_at: sql<Date>`NOW(3)`,
          attempts: row.attempts + 1,
          last_error: null,
        })
        .where('id', '=', row.id)
        .execute()
      sent++
    } catch (err) {
      failed++
      const attempts = row.attempts + 1
      const message = err instanceof Error ? err.message : String(err)
      const giveUp = attempts >= MAX_ATTEMPTS
      await db
        .updateTable('email_outbox')
        .set({
          status: giveUp ? 'failed' : 'pending',
          attempts,
          last_error: message.slice(0, 2000),
          send_after: giveUp
            ? sql<Date>`NOW(3)`
            : sql<Date>`NOW(3) + INTERVAL ${RETRY_DELAYS_MIN[attempts - 1]} MINUTE`,
        })
        .where('id', '=', row.id)
        .execute()
      opts.log?.error(
        { emailId: row.id, kind: row.kind, attempts, err: message },
        'Fallo al enviar email',
      )
    }
  }
  return { sent, failed }
}

function parseHeaders(raw: Record<string, string> | string | null) {
  if (!raw) return undefined
  return typeof raw === 'string' ? (JSON.parse(raw) as Record<string, string>) : raw
}

/**
 * Arranca el procesado periódico de la cola. Devuelve una función para pararlo.
 * `unref()` para que el temporizador no impida cerrar el proceso.
 */
export function startOutboxWorker(db: Kysely<Database>, opts: ProcessOptions, everyMs = 5000) {
  let running = false
  const timer = setInterval(async () => {
    if (running) return
    running = true
    try {
      await processOutbox(db, opts)
    } catch (err) {
      opts.log?.error({ err }, 'Error procesando la cola de emails')
    } finally {
      running = false
    }
  }, everyMs)
  timer.unref()
  return () => clearInterval(timer)
}
