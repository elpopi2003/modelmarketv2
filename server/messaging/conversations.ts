import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import type { Db } from '../db/client'
import { isDuplicateKey } from '../db/errors'
import { listingVisibleTo, type Viewer } from '../content/viewer'
import { HttpError, badRequest, notFound } from '../http/reply'
import { notifyNewMessage, type MessagingDeps } from './notifications'
import { resolvePeople, resolveSubjects } from './subjects'

type Participant = NonNullable<Viewer>

/** La conversación, si quien pregunta participa en ella. Si no, 404 (no se revela que existe). */
export async function getConversationFor(db: Db, viewer: Participant, id: string) {
  const c = await db
    .selectFrom('conversations')
    .selectAll()
    .where('id', '=', id)
    .where((eb) => eb.or([eb('buyer_id', '=', viewer.userId), eb('seller_id', '=', viewer.userId)]))
    .executeTakeFirst()
  if (!c) throw notFound('Esta conversación no existe.')
  return c
}

const otherParty = (c: { buyer_id: string; seller_id: string }, me: string) =>
  c.buyer_id === me ? c.seller_id : c.buyer_id

/** Bandeja: conversaciones del usuario (sin las que borró por su lado), más recientes primero. */
export async function listConversations(db: Db, viewer: Participant) {
  const me = viewer.userId
  const convs = await db
    .selectFrom('conversations')
    .selectAll()
    .where((eb) =>
      eb.or([
        eb.and([eb('buyer_id', '=', me), eb('buyer_deleted_at', 'is', null)]),
        eb.and([eb('seller_id', '=', me), eb('seller_deleted_at', 'is', null)]),
      ]),
    )
    .orderBy('updated_at', 'desc')
    .execute()
  if (convs.length === 0) return []

  const subjectOf = await resolveSubjects(
    db,
    viewer,
    convs.map((c) => ({ listingId: c.listing_id, requestId: c.request_id })),
  )
  const person = await resolvePeople(
    db,
    convs.map((c) => otherParty(c, me)),
  )

  return convs.map((conversation) => {
    const s = subjectOf({ listingId: conversation.listing_id, requestId: conversation.request_id })
    const other = otherParty(conversation, me)
    return {
      conversation,
      otherUserId: other,
      otherName: person(other).name,
      subjectKind: s.kind,
      subjectTitle: s.title,
      subjectAvailable: s.available,
      subjectCover: s.cover,
      subjectLink: s.link,
    }
  })
}

/** "Contactar" desde un anuncio: abre la conversación comprador ↔ vendedor o reutiliza la existente. */
export async function getOrCreateListingConversation(
  db: Db,
  viewer: Participant,
  listingId: string,
) {
  const listing = await db
    .selectFrom('listings')
    .select(['id', 'user_id'])
    .where('id', '=', listingId)
    .where(listingVisibleTo(viewer))
    .executeTakeFirst()
  if (!listing) throw notFound('Este anuncio no existe o ya no está disponible.')
  if (listing.user_id === viewer.userId) throw badRequest('No puedes contactarte a ti mismo.')
  return findOrCreate(db, {
    listing_id: listingId,
    request_id: null,
    buyer_id: viewer.userId,
    seller_id: listing.user_id,
  })
}

/** Busca o crea la conversación. Seguro ante dos peticiones simultáneas (UNIQUE + reintento). */
export async function findOrCreate(
  db: Db,
  c: { listing_id: string | null; request_id: string | null; buyer_id: string; seller_id: string },
): Promise<string> {
  const find = () => {
    let q = db.selectFrom('conversations').select('id')
    q = c.listing_id
      ? q.where('listing_id', '=', c.listing_id).where('buyer_id', '=', c.buyer_id)
      : q.where('request_id', '=', c.request_id!).where('seller_id', '=', c.seller_id)
    return q.executeTakeFirst()
  }
  const existing = await find()
  if (existing) return existing.id
  const id = randomUUID()
  try {
    await db
      .insertInto('conversations')
      .values({ id, ...c, buyer_deleted_at: null, seller_deleted_at: null })
      .execute()
    return id
  } catch (err) {
    if (!isDuplicateKey(err)) throw err
    return (await find())!.id
  }
}

export async function listMessages(db: Db, viewer: Participant, conversationId: string) {
  await getConversationFor(db, viewer, conversationId)
  return db
    .selectFrom('messages')
    .selectAll()
    .where('conversation_id', '=', conversationId)
    .orderBy('created_at', 'asc')
    .orderBy('id', 'asc')
    .execute()
}

/**
 * Inserta un mensaje y "despierta" la conversación: sube arriba en la bandeja y vuelve a
 * aparecer para quien la hubiera borrado por su lado (como el trigger de v2).
 */
export async function insertMessage(
  db: Db,
  conversationId: string,
  senderId: string,
  body: string,
  kind: 'text' | 'offer',
) {
  const id = randomUUID()
  await db
    .insertInto('messages')
    .values({ id, conversation_id: conversationId, sender_id: senderId, body, kind, read_at: null })
    .execute()
  await db
    .updateTable('conversations')
    .set({ updated_at: sql<Date>`NOW(3)`, buyer_deleted_at: null, seller_deleted_at: null })
    .where('id', '=', conversationId)
    .execute()
  return db.selectFrom('messages').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
}

export async function sendMessage(
  deps: MessagingDeps,
  viewer: Participant,
  conversationId: string,
  rawBody: string,
) {
  const body = rawBody.trim()
  if (!body) throw badRequest('El mensaje está vacío.')
  return deps.db.transaction().execute(async (trx) => {
    const tdeps = { ...deps, db: trx }
    const c = await getConversationFor(trx, viewer, conversationId)
    const recipient = otherParty(c, viewer.userId)
    const suspended = await trx
      .selectFrom('user_suspensions')
      .select('user_id')
      .where('user_id', '=', recipient)
      .executeTakeFirst()
    if (suspended)
      throw new HttpError(
        403,
        'recipient_unavailable',
        'Esta persona no puede recibir mensajes ahora mismo.',
      )
    const message = await insertMessage(trx, conversationId, viewer.userId, body, 'text')
    await notifyNewMessage(tdeps, recipient, conversationId, body)
    return message
  })
}

/** Marca como leídos los mensajes que me han enviado en esa conversación. */
export async function markConversationRead(db: Db, viewer: Participant, conversationId: string) {
  await getConversationFor(db, viewer, conversationId)
  await db
    .updateTable('messages')
    .set({ read_at: sql<Date>`NOW(3)` })
    .where('conversation_id', '=', conversationId)
    .where('sender_id', '!=', viewer.userId)
    .where('read_at', 'is', null)
    .execute()
}

/** Mensajes sin leer en todas mis conversaciones (el globo del icono de mensajes). */
export async function unreadMessageCount(db: Db, userId: string) {
  const r = await db
    .selectFrom('messages as m')
    .innerJoin('conversations as c', 'c.id', 'm.conversation_id')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('m.read_at', 'is', null)
    .where('m.sender_id', '!=', userId)
    .where((eb) => eb.or([eb('c.buyer_id', '=', userId), eb('c.seller_id', '=', userId)]))
    .executeTakeFirstOrThrow()
  return Number(r.n)
}

/** Oculta la conversación solo para mí. Si la otra persona escribe, reaparece. */
export async function hideConversation(db: Db, viewer: Participant, conversationId: string) {
  const c = await getConversationFor(db, viewer, conversationId)
  await db
    .updateTable('conversations')
    .set(
      c.buyer_id === viewer.userId
        ? { buyer_deleted_at: sql<Date>`NOW(3)` }
        : { seller_deleted_at: sql<Date>`NOW(3)` },
    )
    .where('id', '=', conversationId)
    .execute()
}
