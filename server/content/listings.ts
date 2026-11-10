import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import type { z } from 'zod'
import { LISTING_STATUSES_COUNTING, countsTowardListingLimit } from '@/lib/subscription'
import type { Db } from '../db/client'
import { isMissingReference } from '../db/errors'
import { jsonArray, toJson } from '../db/json'
import { badRequest, notFound } from '../http/reply'
import { deleteUploads, unreferencedPhotos } from '../uploads/images'
import { toListingDto } from './dto'
import {
  assertNotModerated,
  assertOwnerOrAdmin,
  assertPhotosAllowed,
  assertWithinLimit,
  likePattern,
} from './rules'
import type { listingCreateSchema, listingFiltersSchema, listingUpdateSchema } from './schemas'
import { getUserCapabilities } from './tier'
import { listingIsPublic, listingVisibleTo, type Viewer } from './viewer'

export interface ContentDeps {
  db: Db
  uploadsDir: string
}

type Filters = z.infer<typeof listingFiltersSchema>
type CreateInput = z.infer<typeof listingCreateSchema>
type UpdateInput = z.infer<typeof listingUpdateSchema>

/** Tope de seguridad del catálogo público; la paginación de la interfaz es de 30 en 30. */
const PUBLIC_LIMIT = 1000

const BAD_REFERENCE = () => badRequest('La categoría o la marca no existen.', 'invalid_reference')

/** Catálogo público: activos y reservados ya publicados, de autores no suspendidos. */
export async function listPublicListings(db: Db, f: Filters) {
  let q = db.selectFrom('listings').selectAll().where(listingIsPublic)
  if (f.category) q = q.where('category_id', '=', f.category)
  if (f.brand) q = q.where('brand_id', '=', f.brand)
  if (f.condition) q = q.where('condition', '=', f.condition)
  // La intercalación utf8mb4_unicode_ci ignora tildes y mayúsculas: "aviacion" encuentra "Aviación".
  if (f.q) q = q.where('title', 'like', likePattern(f.q))
  if (f.minPrice !== undefined) q = q.where('price_cents', '>=', f.minPrice)
  if (f.maxPrice !== undefined) q = q.where('price_cents', '<=', f.maxPrice)
  q =
    f.sort === 'price_asc'
      ? q.orderBy('price_cents', 'asc').orderBy('created_at', 'desc')
      : f.sort === 'price_desc'
        ? q.orderBy('price_cents', 'desc').orderBy('created_at', 'desc')
        : q.orderBy('created_at', 'desc')
  const rows = await q.limit(PUBLIC_LIMIT).execute()
  return rows.map(toListingDto)
}

export async function getListing(db: Db, id: string, viewer: Viewer) {
  const row = await db
    .selectFrom('listings')
    .selectAll()
    .where('id', '=', id)
    .where(listingVisibleTo(viewer))
    .executeTakeFirst()
  if (!row) throw notFound('Este anuncio no existe o ya no está disponible.')
  return toListingDto(row)
}

/** Todos los anuncios del usuario, en cualquier estado (también los retirados). */
export async function listMyListings(db: Db, userId: string) {
  const rows = await db
    .selectFrom('listings')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('created_at', 'desc')
    .execute()
  return rows.map(toListingDto)
}

async function countActive(db: Db, userId: string, exceptId?: string) {
  let q = db
    .selectFrom('listings')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('user_id', '=', userId)
    .where('status', 'in', [...LISTING_STATUSES_COUNTING])
  if (exceptId) q = q.where('id', '!=', exceptId)
  return Number((await q.executeTakeFirstOrThrow()).n)
}

/**
 * Publica un anuncio. Hace cumplir el plan del autor: número de anuncios activos, número
 * de fotos y retardo de visibilidad (Free: 24 h; PRO/Retail: inmediato).
 */
export async function createListing(deps: ContentDeps, userId: string, input: CreateInput) {
  const { db } = deps
  const caps = await getUserCapabilities(db, userId)
  await assertPhotosAllowed({
    photos: input.photos,
    ownerId: userId,
    existing: [],
    maxPhotos: caps.maxPhotosPerItem,
    uploadsDir: deps.uploadsDir,
  })

  const id = randomUUID()
  await db.transaction().execute(async (trx) => {
    // Bloquea la fila del usuario: dos altas simultáneas no pueden saltarse el límite.
    await trx.selectFrom('users').select('id').where('id', '=', userId).forUpdate().execute()
    assertWithinLimit(caps, await countActive(trx, userId), 'listing')
    try {
      await trx
        .insertInto('listings')
        .values({
          id,
          user_id: userId,
          title: input.title,
          description: input.description || null,
          price_cents: input.price_cents,
          condition: input.condition,
          decals: input.decals,
          scale: input.scale || null,
          category_id: input.category_id ?? null,
          brand_id: input.brand_id ?? null,
          photos: toJson(input.photos),
          previous_status: null,
          shipping_inpost: input.shipping_inpost,
          hand_delivery: input.hand_delivery,
          accepts_offers: input.accepts_offers,
          visible_at: new Date(Date.now() + caps.visibilityDelayHours * 3_600_000),
        })
        .execute()
    } catch (err) {
      if (isMissingReference(err)) throw BAD_REFERENCE()
      throw err
    }
  })
  return getListing(db, id, { userId, isAdmin: false })
}

export async function updateListing(
  deps: ContentDeps,
  viewer: Viewer,
  id: string,
  input: UpdateInput,
) {
  const { db } = deps
  let removedPhotos: string[] = []

  await db.transaction().execute(async (trx) => {
    const row = await trx
      .selectFrom('listings')
      .selectAll()
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst()
    if (!row) throw notFound('Este anuncio no existe.')
    assertOwnerOrAdmin(viewer, row.user_id)

    const statusChanges = input.status !== undefined && input.status !== row.status
    if (statusChanges) assertNotModerated(viewer, row.previous_status, 'restaurarlo')

    // Reactivar algo que no contaba (vendido, archivado) vuelve a ocupar hueco del plan.
    const caps = await getUserCapabilities(trx, row.user_id)
    if (
      statusChanges &&
      !viewer.isAdmin &&
      countsTowardListingLimit(input.status!) &&
      !countsTowardListingLimit(row.status)
    ) {
      assertWithinLimit(caps, await countActive(trx, row.user_id, id), 'listing')
    }

    const current = jsonArray<string>(row.photos)
    if (input.photos) {
      if (input.photos.length === 0) throw badRequest('Añade al menos una foto.')
      await assertPhotosAllowed({
        photos: input.photos,
        ownerId: row.user_id,
        existing: current,
        maxPhotos: caps.maxPhotosPerItem,
        uploadsDir: deps.uploadsDir,
        bypassLimit: viewer.isAdmin,
      })
      removedPhotos = current.filter((u) => !input.photos!.includes(u))
    }

    const { photos, ...fields } = input
    try {
      await trx
        .updateTable('listings')
        .set({
          ...fields,
          ...(fields.description !== undefined ? { description: fields.description || null } : {}),
          ...(fields.scale !== undefined ? { scale: fields.scale || null } : {}),
          ...(photos ? { photos: toJson(photos) } : {}),
          // Si se quita la imagen de catálogo, deja de haber nada que etiquetar.
          ...(photos && row.catalog_photo && !photos.includes(row.catalog_photo)
            ? { catalog_photo: null }
            : {}),
        })
        .where('id', '=', id)
        .execute()
    } catch (err) {
      if (isMissingReference(err)) throw BAD_REFERENCE()
      throw err
    }
  })

  await deleteUploads(deps.uploadsDir, await unreferencedPhotos(db, removedPhotos))
  return getListing(db, id, viewer)
}

export async function deleteListing(deps: ContentDeps, viewer: Viewer, id: string) {
  const row = await deps.db
    .selectFrom('listings')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
  if (!row) throw notFound('Este anuncio no existe.')
  assertOwnerOrAdmin(viewer, row.user_id)
  assertNotModerated(viewer, row.previous_status, 'eliminarlo')
  await deps.db.deleteFrom('listings').where('id', '=', id).execute()
  await deleteUploads(deps.uploadsDir, await unreferencedPhotos(deps.db, jsonArray(row.photos)))
}

/** Suma una visita. Los borradores no cuentan. Silencioso si el anuncio no existe. */
export async function incrementViews(db: Db, id: string) {
  await db
    .updateTable('listings')
    .set({ views: sql<number>`views + 1` })
    .where('id', '=', id)
    .where('status', '!=', 'draft')
    .execute()
}

/** Contador público de favoritos: cuántos, nunca quiénes. */
export async function favoriteCount(db: Db, listingId: string) {
  const r = await db
    .selectFrom('favorites')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('listing_id', '=', listingId)
    .executeTakeFirstOrThrow()
  return Number(r.n)
}
