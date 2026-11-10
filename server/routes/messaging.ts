import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../auth/plugin'
import { viewerOf } from '../content/viewer'
import { ok } from '../http/reply'
import { parse } from '../http/validate'
import * as conversations from '../messaging/conversations'
import * as notifications from '../messaging/notifications'
import * as offers from '../messaging/offers'

const idParam = z.object({ id: z.string().uuid('ID no válido') })
const limit = (max: number, minutes: number) => ({
  config: { rateLimit: { max, timeWindow: minutes * 60_000 } },
})

const messageBody = z.object({
  body: z
    .string({ required_error: 'El mensaje está vacío' })
    .trim()
    .min(1, 'El mensaje está vacío')
    .max(4000, 'El mensaje es demasiado largo (máximo 4000 caracteres)'),
})

const offerBody = z
  .object({
    listingId: z.string().uuid().nullish(),
    requestId: z.string().uuid().nullish(),
    amountCents: z
      .number({
        required_error: 'Indica un importe',
        invalid_type_error: 'El importe no es válido',
      })
      .int('El importe no es válido')
      .min(0, 'El importe no puede ser negativo')
      .max(100_000_000, 'El importe es demasiado alto'),
    message: z.string().trim().max(1000, 'El mensaje admite como máximo 1000 caracteres').nullish(),
  })
  .refine((o) => !o.listingId !== !o.requestId, 'Indica un anuncio o una petición, no ambos')

/** Conversaciones, mensajes, ofertas y notificaciones. Todo exige sesión salvo los contadores públicos. */
export const messagingRoutes: FastifyPluginAsync = async (app) => {
  const { db, config } = app.deps
  const deps = { db, mail: { appUrl: config.APP_URL, logoUrl: config.MAIL_LOGO_URL } }
  const me = (req: Parameters<typeof requireAuth>[0]) => {
    requireAuth(req)
    return viewerOf(req)!
  }

  // ── Conversaciones ────────────────────────────────────────────────────────
  app.get('/conversations', async (req) => ok(await conversations.listConversations(db, me(req))))
  app.post('/conversations', limit(30, 15), async (req) => {
    const viewer = me(req)
    const { listingId } = parse(
      z.object({ listingId: z.string().uuid('Anuncio no válido') }),
      req.body,
    )
    return ok({ id: await conversations.getOrCreateListingConversation(db, viewer, listingId) })
  })
  app.get('/conversations/:id/messages', async (req) => {
    const { id } = parse(idParam, req.params)
    return ok(await conversations.listMessages(db, me(req), id))
  })
  app.post('/conversations/:id/messages', limit(60, 5), async (req) => {
    const viewer = me(req)
    const { id } = parse(idParam, req.params)
    const { body } = parse(messageBody, req.body)
    return ok(await conversations.sendMessage(deps, viewer, id, body))
  })
  app.post('/conversations/:id/read', async (req) => {
    const { id } = parse(idParam, req.params)
    await conversations.markConversationRead(db, me(req), id)
    return ok({ read: true })
  })
  app.delete('/conversations/:id', async (req) => {
    const { id } = parse(idParam, req.params)
    await conversations.hideConversation(db, me(req), id)
    return ok({ hidden: true })
  })
  app.get('/messages/unread-count', async (req) =>
    ok({ count: await conversations.unreadMessageCount(db, requireAuth(req).userId) }),
  )

  // ── Ofertas ───────────────────────────────────────────────────────────────
  app.post('/offers', limit(30, 15), async (req) => {
    const viewer = me(req)
    const input = parse(offerBody, req.body)
    return ok({ conversationId: await offers.createOffer(deps, viewer, input) })
  })
  app.patch('/offers/:id', async (req) => {
    const viewer = me(req)
    const { id } = parse(idParam, req.params)
    const { status } = parse(
      z.object({ status: z.enum(['accepted', 'rejected', 'withdrawn']) }),
      req.body,
    )
    await offers.respondToOffer(deps, viewer, id, status)
    return ok({ status })
  })
  app.get('/offers', async (req) => {
    const { box } = parse(
      z.object({ box: z.enum(['received', 'sent']).default('received') }),
      req.query,
    )
    return ok(await offers.listOffersBox(db, me(req), box))
  })
  app.get('/listings/:id/offers', async (req) => {
    const { id } = parse(idParam, req.params)
    return ok(await offers.listOffersFor(db, me(req), { listingId: id }))
  })
  app.get('/requests/:id/offers', async (req) => {
    const { id } = parse(idParam, req.params)
    return ok(await offers.listOffersFor(db, me(req), { requestId: id }))
  })
  app.get('/requests/:id/offer-count', async (req) => {
    const { id } = parse(idParam, req.params)
    return ok({ count: await offers.requestOfferCount(db, id) })
  })

  // ── Notificaciones ────────────────────────────────────────────────────────
  app.get('/notifications', async (req) =>
    ok(await notifications.listNotifications(db, requireAuth(req).userId)),
  )
  app.get('/notifications/unread-count', async (req) =>
    ok({ count: await notifications.unreadNotificationCount(db, requireAuth(req).userId) }),
  )
  app.post('/notifications/read-all', async (req) => {
    await notifications.markAllNotificationsRead(db, requireAuth(req).userId)
    return ok({ read: true })
  })
}
