import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../auth/plugin'
import * as catalog from '../content/catalog'
import * as favorites from '../content/favorites'
import * as listings from '../content/listings'
import * as requests from '../content/requests'
import {
  brandNameSchema,
  idsQuerySchema,
  listingCreateSchema,
  listingFiltersSchema,
  listingUpdateSchema,
  requestCreateSchema,
  requestFiltersSchema,
  requestUpdateSchema,
} from '../content/schemas'
import { getPaidTier, getPublicTiers, getUserTier } from '../content/tier'
import { viewerOf } from '../content/viewer'
import { ok } from '../http/reply'
import { notify } from '../messaging/notifications'
import { parse } from '../http/validate'

const idParam = z.object({ id: z.string().uuid('ID no válido') })
const limit = (max: number, minutes: number) => ({
  config: { rateLimit: { max, timeWindow: minutes * 60_000 } },
})

/** Catálogo, anuncios, peticiones, favoritos y plan. */
export const contentRoutes: FastifyPluginAsync = async (app) => {
  const { db, config } = app.deps
  const deps = { db, uploadsDir: config.UPLOADS_DIR }

  // ── Catálogos ─────────────────────────────────────────────────────────────
  app.get('/catalog/categories', async (_req, reply) => {
    reply.header('Cache-Control', 'public, max-age=300')
    return ok(await catalog.listCategories(db))
  })
  app.get('/catalog/brands', async () => ok(await catalog.listBrands(db)))
  app.post('/catalog/brands', limit(30, 15), async (req) => {
    requireAuth(req)
    const { name } = parse(brandNameSchema, req.body)
    return ok({ id: await catalog.getOrCreateBrand(db, name) })
  })

  // ── Anuncios ──────────────────────────────────────────────────────────────
  app.get('/listings', async (req) =>
    ok(await listings.listPublicListings(db, parse(listingFiltersSchema, req.query))),
  )
  app.get('/listings/mine', async (req) =>
    ok(await listings.listMyListings(db, requireAuth(req).userId)),
  )
  app.get('/listings/:id', async (req) => {
    const { id } = parse(idParam, req.params)
    return ok(await listings.getListing(db, id, viewerOf(req)))
  })
  app.post('/listings', limit(20, 15), async (req) => {
    const { userId } = requireAuth(req)
    return ok(await listings.createListing(deps, userId, parse(listingCreateSchema, req.body)))
  })
  app.patch('/listings/:id', async (req) => {
    requireAuth(req)
    const { id } = parse(idParam, req.params)
    return ok(
      await listings.updateListing(deps, viewerOf(req), id, parse(listingUpdateSchema, req.body)),
    )
  })
  app.delete('/listings/:id', async (req) => {
    requireAuth(req)
    const { id } = parse(idParam, req.params)
    await listings.deleteListing(deps, viewerOf(req), id)
    return ok({ deleted: true })
  })
  app.post('/listings/:id/view', limit(60, 1), async (req) => {
    const { id } = parse(idParam, req.params)
    await listings.incrementViews(db, id)
    return ok({ counted: true })
  })
  app.get('/listings/:id/favorite-count', async (req) => {
    const { id } = parse(idParam, req.params)
    return ok({ count: await listings.favoriteCount(db, id) })
  })

  // ── Peticiones ────────────────────────────────────────────────────────────
  app.get('/requests', async (req) =>
    ok(await requests.listPublicRequests(db, parse(requestFiltersSchema, req.query))),
  )
  app.get('/requests/mine', async (req) =>
    ok(await requests.listMyRequests(db, requireAuth(req).userId)),
  )
  app.get('/requests/:id', async (req) => {
    const { id } = parse(idParam, req.params)
    return ok(await requests.getRequest(db, id, viewerOf(req)))
  })
  app.post('/requests', limit(20, 15), async (req) => {
    const { userId } = requireAuth(req)
    return ok(await requests.createRequest(deps, userId, parse(requestCreateSchema, req.body)))
  })
  app.patch('/requests/:id', async (req) => {
    requireAuth(req)
    const { id } = parse(idParam, req.params)
    return ok(
      await requests.updateRequest(deps, viewerOf(req), id, parse(requestUpdateSchema, req.body)),
    )
  })
  app.delete('/requests/:id', async (req) => {
    requireAuth(req)
    const { id } = parse(idParam, req.params)
    await requests.deleteRequest(deps, viewerOf(req), id)
    return ok({ deleted: true })
  })

  // ── Favoritos ─────────────────────────────────────────────────────────────
  app.get('/favorites/ids', async (req) =>
    ok(await favorites.listFavoriteIds(db, requireAuth(req).userId)),
  )
  app.get('/favorites/listings', async (req) => {
    requireAuth(req)
    return ok(await favorites.listFavoriteListings(db, viewerOf(req)!))
  })
  app.put('/favorites/:id', limit(120, 15), async (req) => {
    requireAuth(req)
    const { id } = parse(idParam, req.params)
    const viewer = viewerOf(req)!
    const { created, ownerId } = await favorites.addFavorite(db, viewer, id)
    // Aviso al dueño la primera vez que alguien lo guarda (no al guardar lo propio).
    if (created && ownerId !== viewer.userId) {
      await notify(
        { db, mail: { appUrl: config.APP_URL, logoUrl: config.MAIL_LOGO_URL } },
        {
          userId: ownerId,
          type: 'favorite',
          title: 'Han guardado tu anuncio',
          link: `/producto/${id}`,
        },
      )
    }
    return ok({ favorited: true, created })
  })
  app.delete('/favorites/:id', async (req) => {
    const { userId } = requireAuth(req)
    const { id } = parse(idParam, req.params)
    await favorites.removeFavorite(db, userId, id)
    return ok({ favorited: false })
  })

  // ── Plan (lectura; el pago con Stripe llega en la fase de pagos) ────────────
  app.get('/subscription', async (req) => {
    const { userId } = requireAuth(req)
    return ok({ tier: await getUserTier(db, userId), paidTier: await getPaidTier(db, userId) })
  })
  // Datos públicos de la plataforma que el frontend necesita sin sesión.
  app.get('/platform', async () => ok({ betaAllPro: config.BETA_ALL_PRO }))
  app.get('/subscription/public-tiers', async (req) => {
    const { ids } = parse(idsQuerySchema, req.query)
    return ok(await getPublicTiers(db, ids))
  })
}
