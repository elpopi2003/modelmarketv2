import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import type { Db } from '../db/client'
import type { LayoutContext } from '../email/layout'
import { enqueueEmail } from '../email/outbox'
import { notificationEmail } from '../email/templates/notification'

export interface MessagingDeps {
  db: Db
  mail: LayoutContext
}

export interface NewNotification {
  userId: string
  type: 'message' | 'offer' | 'favorite' | 'report' | (string & {})
  title: string
  body?: string | null
  link?: string | null
}

const NOTIFICATIONS_LIMIT = 50
/** Recorte del texto de un mensaje u oferta en el aviso, como en v2. */
export const excerpt = (text: string | null | undefined, max = 80) =>
  text ? (text.length > max ? `${text.slice(0, max - 1)}…` : text) : null

/**
 * Crea un aviso y, si el destinatario no ha desactivado los emails, encola el correo.
 * Sustituye a los triggers `notify_on_*` y al webhook `send-notification-email` de v2.
 * Se llama dentro de la transacción de la acción que lo provoca.
 */
export async function notify(deps: MessagingDeps, n: NewNotification) {
  const { db } = deps
  await db
    .insertInto('notifications')
    .values({
      id: randomUUID(),
      user_id: n.userId,
      type: n.type,
      title: n.title.slice(0, 200),
      body: n.body ?? null,
      link: n.link ?? null,
      read_at: null,
    })
    .execute()
  await emailIfWanted(deps, n)
}

async function emailIfWanted(deps: MessagingDeps, n: NewNotification) {
  const r = await deps.db
    .selectFrom('users as u')
    .innerJoin('profiles as p', 'p.id', 'u.id')
    .select(['u.email', 'p.notify_email'])
    .where('u.id', '=', n.userId)
    .executeTakeFirst()
  if (!r || !r.notify_email) return
  await enqueueEmail(deps.db, {
    to: r.email,
    kind: `notification:${n.type}`,
    content: notificationEmail(n, deps.mail),
    // Para los clientes de correo que ofrecen "darse de baja": lleva a la configuración.
    headers: { 'List-Unsubscribe': `<${deps.mail.appUrl}/configuracion>` },
  })
}

/**
 * Aviso de mensaje nuevo. Si ya hay uno sin leer de esa conversación, se actualiza en vez
 * de crear otro (y no se manda un email por cada mensaje de una charla seguida).
 */
export async function notifyNewMessage(
  deps: MessagingDeps,
  recipientId: string,
  conversationId: string,
  body: string,
) {
  const link = `/mensajes/${conversationId}`
  const updated = await deps.db
    .updateTable('notifications')
    .set({ created_at: sql<Date>`NOW(3)`, title: 'Nuevo mensaje', body: excerpt(body) })
    .where('user_id', '=', recipientId)
    .where('type', '=', 'message')
    .where('link', '=', link)
    .where('read_at', 'is', null)
    .executeTakeFirst()
  if (Number(updated.numUpdatedRows) > 0) return
  await notify(deps, {
    userId: recipientId,
    type: 'message',
    title: 'Nuevo mensaje',
    body: excerpt(body),
    link,
  })
}

export async function listNotifications(db: Db, userId: string) {
  return db
    .selectFrom('notifications')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('created_at', 'desc')
    .limit(NOTIFICATIONS_LIMIT)
    .execute()
}

export async function unreadNotificationCount(db: Db, userId: string) {
  const r = await db
    .selectFrom('notifications')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('user_id', '=', userId)
    .where('read_at', 'is', null)
    .executeTakeFirstOrThrow()
  return Number(r.n)
}

export async function markAllNotificationsRead(db: Db, userId: string) {
  await db
    .updateTable('notifications')
    .set({ read_at: sql<Date>`NOW(3)` })
    .where('user_id', '=', userId)
    .where('read_at', 'is', null)
    .execute()
}
