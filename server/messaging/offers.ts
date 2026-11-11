import { randomUUID } from 'node:crypto'
import type { Db } from '../db/client'
import { isDuplicateKey } from '../db/errors'
import { getUserCapabilities } from '../content/tier'
import { listingVisibleTo, requestVisibleTo, type Viewer } from '../content/viewer'
import { HttpError, badRequest, forbidden, notFound } from '../http/reply'
import { findOrCreate, insertMessage } from './conversations'
import { excerpt, notify, type MessagingDeps } from './notifications'
import { resolvePeople, resolveSubjects } from './subjects'

type Participant = NonNullable<Viewer>

/** "12.50 €": mismo formato que generaba Postgres en v2 (lo leen los mensajes de oferta). */
export const formatAmount = (cents: number) => `${(cents / 100).toFixed(2)} €`

export interface CreateOfferInput {
  listingId?: string | null
  requestId?: string | null
  amountCents: number
  message?: string | null
}

/**
 * Crea una oferta, o actualiza la pendiente que ya tuviera esa persona sobre lo mismo.
 * Abre/reutiliza la conversación, deja el mensaje de oferta y avisa al destinatario.
 * Devuelve el id de la conversación. Equivale a la RPC `create_offer` de v2.
 *
 *  - Anuncio: cualquiera; si el vendedor no acepta regateo, no por debajo del precio.
 *  - Petición: solo PRO/Retail (responder a peticiones es de pago).
 */
export async function createOffer(
  deps: MessagingDeps,
  viewer: Participant,
  input: CreateOfferInput,
): Promise<string> {
  const me = viewer.userId
  const { listingId = null, requestId = null, amountCents } = input
  if (!listingId === !requestId) throw badRequest('Indica un anuncio o una petición, no ambos.')
  const message = input.message?.trim() || null

  return deps.db.transaction().execute(async (trx) => {
    const tdeps = { ...deps, db: trx }
    let to: string
    let conversationId: string

    if (listingId) {
      // FOR UPDATE: dos ofertas simultáneas del mismo usuario no pueden crear dos pendientes.
      const l = await trx
        .selectFrom('listings')
        .select(['id', 'user_id', 'price_cents', 'accepts_offers', 'status'])
        .where('id', '=', listingId)
        .where(listingVisibleTo(viewer))
        .forUpdate()
        .executeTakeFirst()
      if (!l) throw notFound('Este anuncio no existe o ya no está disponible.')
      if (l.user_id === me) throw badRequest('No puedes ofertar sobre tu propio anuncio.')
      if (l.status === 'sold') throw badRequest('Este anuncio ya está vendido.', 'listing_sold')
      if (!l.accepts_offers && amountCents < l.price_cents) {
        throw badRequest(
          'Este vendedor no acepta ofertas por debajo del precio publicado.',
          'no_haggling',
        )
      }
      to = l.user_id
      conversationId = await findOrCreate(trx, {
        listing_id: listingId,
        request_id: null,
        buyer_id: me,
        seller_id: to,
      })
    } else {
      const r = await trx
        .selectFrom('requests')
        .select(['id', 'user_id', 'status'])
        .where('id', '=', requestId!)
        .where(requestVisibleTo(viewer))
        .forUpdate()
        .executeTakeFirst()
      if (!r) throw notFound('Esta petición no existe o ya no está disponible.')
      if (r.user_id === me) throw badRequest('No puedes ofertar sobre tu propia petición.')
      if (r.status !== 'open') throw badRequest('Esta petición ya no admite ofertas.')
      const caps = await getUserCapabilities(trx, me)
      if (!caps.canRespondToRequests) {
        throw new HttpError(403, 'plan_required', 'Responder a peticiones requiere el plan PRO.')
      }
      to = r.user_id
      // En una petición, quien la publicó es el "comprador" y quien ofrece, el "vendedor".
      conversationId = await findOrCreate(trx, {
        listing_id: null,
        request_id: requestId,
        buyer_id: to,
        seller_id: me,
      })
    }

    const body = `Oferta: ${formatAmount(amountCents)}${message ? `\n${message}` : ''}`
    await insertMessage(trx, conversationId, me, body, 'offer')

    let existing = trx
      .selectFrom('offers')
      .select(['id', 'amount_cents'])
      .where('from_user_id', '=', me)
      .where('status', '=', 'pending')
    existing = listingId
      ? existing.where('listing_id', '=', listingId)
      : existing.where('request_id', '=', requestId!)
    const pending = await existing.executeTakeFirst()

    if (pending) {
      await trx
        .updateTable('offers')
        .set({ amount_cents: amountCents, message, conversation_id: conversationId })
        .where('id', '=', pending.id)
        .execute()
      // Como el trigger de v2: solo se avisa si cambia el importe.
      if (pending.amount_cents !== amountCents) {
        await notify(tdeps, {
          userId: to,
          type: 'offer',
          title: `Oferta actualizada: ${formatAmount(amountCents)}`,
          body: excerpt(message),
          link: `/mensajes/${conversationId}`,
        })
      }
    } else {
      try {
        await trx
          .insertInto('offers')
          .values({
            id: randomUUID(),
            listing_id: listingId,
            request_id: requestId,
            from_user_id: me,
            to_user_id: to,
            conversation_id: conversationId,
            amount_cents: amountCents,
            message,
          })
          .execute()
      } catch (err) {
        if (isDuplicateKey(err))
          throw new HttpError(409, 'offer_pending', 'Ya tienes una oferta pendiente sobre esto.')
        throw err
      }
      await notify(tdeps, {
        userId: to,
        type: 'offer',
        title: `Nueva oferta: ${formatAmount(amountCents)}`,
        body: excerpt(message),
        link: `/mensajes/${conversationId}`,
      })
    }
    return conversationId
  })
}

/**
 * Aceptar o rechazar (quien la recibe) o retirar (quien la envió). Aceptar una oferta
 * sobre un anuncio lo marca como reservado. Equivale a `respond_to_offer` de v2.
 */
export async function respondToOffer(
  deps: MessagingDeps,
  viewer: Participant,
  offerId: string,
  status: 'accepted' | 'rejected' | 'withdrawn',
) {
  await deps.db.transaction().execute(async (trx) => {
    const o = await trx
      .selectFrom('offers')
      .selectAll()
      .where('id', '=', offerId)
      .forUpdate()
      .executeTakeFirst()
    if (!o || (o.from_user_id !== viewer.userId && o.to_user_id !== viewer.userId)) {
      throw notFound('Esta oferta no existe.')
    }
    if (o.status !== 'pending') throw badRequest('Esta oferta ya está resuelta.', 'offer_resolved')
    if (status === 'withdrawn' && o.from_user_id !== viewer.userId) {
      throw forbidden('Solo quien envió la oferta puede retirarla.')
    }
    if (status !== 'withdrawn' && o.to_user_id !== viewer.userId) {
      throw forbidden('Solo quien recibe la oferta puede aceptarla o rechazarla.')
    }

    await trx.updateTable('offers').set({ status }).where('id', '=', offerId).execute()
    if (status === 'accepted' && o.listing_id) {
      await trx
        .updateTable('listings')
        .set({ status: 'reserved' })
        .where('id', '=', o.listing_id)
        .where('status', '=', 'active')
        .execute()
    }
    if (status !== 'withdrawn') {
      await notify(
        { ...deps, db: trx },
        {
          userId: o.from_user_id,
          type: 'offer',
          title: status === 'accepted' ? 'Han aceptado tu oferta' : 'Han rechazado tu oferta',
          link: o.conversation_id ? `/mensajes/${o.conversation_id}` : null,
        },
      )
    }
  })
}

/** Bandeja de ofertas: las que me han hecho o las que he enviado, con su asunto y la otra parte. */
export async function listOffersBox(db: Db, viewer: Participant, box: 'received' | 'sent') {
  const offers = await db
    .selectFrom('offers')
    .selectAll()
    .where(box === 'received' ? 'to_user_id' : 'from_user_id', '=', viewer.userId)
    .orderBy('created_at', 'desc')
    .execute()
  if (offers.length === 0) return []
  const subjectOf = await resolveSubjects(
    db,
    viewer,
    offers.map((o) => ({ listingId: o.listing_id, requestId: o.request_id })),
  )
  const counterpart = (o: (typeof offers)[number]) =>
    box === 'received' ? o.from_user_id : o.to_user_id
  const person = await resolvePeople(db, offers.map(counterpart))
  return offers.map((o) => {
    const s = subjectOf({ listingId: o.listing_id, requestId: o.request_id })
    const p = person(counterpart(o))
    return {
      offer: toOfferDto(o),
      subjectKind: s.kind,
      subjectTitle: s.title,
      subjectAvailable: s.available,
      subjectCover: s.cover,
      subjectLink: s.link,
      counterpartName: p.name,
      counterpartAvatar: p.avatar,
    }
  })
}

/**
 * Ofertas sobre un anuncio o petición que puedo ver: el dueño ve las que ha recibido y
 * quien oferta ve la suya (como la policy `offers_select_involved` de v2).
 */
export async function listOffersFor(
  db: Db,
  viewer: Participant,
  target: { listingId?: string; requestId?: string },
) {
  let q = db
    .selectFrom('offers')
    .selectAll()
    .where((eb) =>
      eb.or([eb('from_user_id', '=', viewer.userId), eb('to_user_id', '=', viewer.userId)]),
    )
  q = target.listingId
    ? q.where('listing_id', '=', target.listingId)
    : q.where('request_id', '=', target.requestId!)
  const offers = await q.orderBy('created_at', 'desc').execute()
  const person = await resolvePeople(
    db,
    offers.map((o) => o.from_user_id),
  )
  return offers.map((o) => {
    const p = person(o.from_user_id)
    return { offer: toOfferDto(o), senderName: p.name, senderAvatar: p.avatar }
  })
}

/** Contador público de ofertas de una petición ("N ofertas"). Las retiradas no cuentan. */
export async function requestOfferCount(db: Db, requestId: string) {
  const r = await db
    .selectFrom('offers')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('request_id', '=', requestId)
    .where('status', '!=', 'withdrawn')
    .executeTakeFirstOrThrow()
  return Number(r.n)
}

/** Sin la columna interna `pending_key`: misma forma que la fila de v2. */
function toOfferDto<T extends { pending_key?: unknown }>(o: T) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pending_key, ...rest } = o
  return rest
}
