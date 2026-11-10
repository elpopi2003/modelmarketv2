import { randomUUID } from 'node:crypto'
import type { z } from 'zod'
import { REQUEST_STATUSES_COUNTING, countsTowardRequestLimit } from '@/lib/subscription'
import type { Db } from '../db/client'
import { isMissingReference } from '../db/errors'
import { jsonArray, toJson } from '../db/json'
import { badRequest, notFound } from '../http/reply'
import { deleteUploads, unreferencedPhotos } from '../uploads/images'
import { toRequestDto } from './dto'
import type { ContentDeps } from './listings'
import {
  assertNotModerated,
  assertOwnerOrAdmin,
  assertPhotosAllowed,
  assertWithinLimit,
  likePattern,
} from './rules'
import type { requestCreateSchema, requestFiltersSchema, requestUpdateSchema } from './schemas'
import { getUserCapabilities } from './tier'
import { requestIsPublic, requestVisibleTo, type Viewer } from './viewer'

type Filters = z.infer<typeof requestFiltersSchema>
type CreateInput = z.infer<typeof requestCreateSchema>
type UpdateInput = z.infer<typeof requestUpdateSchema>

const PUBLIC_LIMIT = 1000
const BAD_REFERENCE = () => badRequest('La categoría o la marca no existen.', 'invalid_reference')

/** Peticiones públicas: abiertas y de autores no suspendidos. */
export async function listPublicRequests(db: Db, f: Filters) {
  let q = db.selectFrom('requests').selectAll().where(requestIsPublic)
  if (f.category) q = q.where('category_id', '=', f.category)
  if (f.brand) q = q.where('brand_id', '=', f.brand)
  if (f.q) q = q.where('title', 'like', likePattern(f.q))
  // Sin presupuesto, al final en ambos órdenes (como `nullsFirst: false` en Postgres).
  q =
    f.sort === 'budget_desc'
      ? q
          .orderBy((eb) => eb('max_price_cents', 'is', null), 'asc')
          .orderBy('max_price_cents', 'desc')
      : f.sort === 'budget_asc'
        ? q
            .orderBy((eb) => eb('max_price_cents', 'is', null), 'asc')
            .orderBy('max_price_cents', 'asc')
        : q.orderBy('created_at', 'desc')
  const rows = await q.limit(PUBLIC_LIMIT).execute()
  return rows.map(toRequestDto)
}

export async function getRequest(db: Db, id: string, viewer: Viewer) {
  const row = await db
    .selectFrom('requests')
    .selectAll()
    .where('id', '=', id)
    .where(requestVisibleTo(viewer))
    .executeTakeFirst()
  if (!row) throw notFound('Esta petición no existe o ya no está disponible.')
  return toRequestDto(row)
}

export async function listMyRequests(db: Db, userId: string) {
  const rows = await db
    .selectFrom('requests')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('created_at', 'desc')
    .execute()
  return rows.map(toRequestDto)
}

async function countActive(db: Db, userId: string, exceptId?: string) {
  let q = db
    .selectFrom('requests')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('user_id', '=', userId)
    .where('status', 'in', [...REQUEST_STATUSES_COUNTING])
  if (exceptId) q = q.where('id', '!=', exceptId)
  return Number((await q.executeTakeFirstOrThrow()).n)
}

export async function createRequest(deps: ContentDeps, userId: string, input: CreateInput) {
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
    await trx.selectFrom('users').select('id').where('id', '=', userId).forUpdate().execute()
    assertWithinLimit(caps, await countActive(trx, userId), 'request')
    try {
      await trx
        .insertInto('requests')
        .values({
          id,
          user_id: userId,
          title: input.title,
          description: input.description || null,
          category_id: input.category_id ?? null,
          brand_id: input.brand_id ?? null,
          scale: input.scale || null,
          max_price_cents: input.max_price_cents ?? null,
          photos: toJson(input.photos),
          accepted_conditions: toJson(input.accepted_conditions),
          decals_requirement: input.decals_requirement,
          urgency: input.urgency,
          previous_status: null,
        })
        .execute()
    } catch (err) {
      if (isMissingReference(err)) throw BAD_REFERENCE()
      throw err
    }
  })
  return getRequest(db, id, { userId, isAdmin: false })
}

export async function updateRequest(
  deps: ContentDeps,
  viewer: Viewer,
  id: string,
  input: UpdateInput,
) {
  const { db } = deps
  let removedPhotos: string[] = []

  await db.transaction().execute(async (trx) => {
    const row = await trx
      .selectFrom('requests')
      .selectAll()
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst()
    if (!row) throw notFound('Esta petición no existe.')
    assertOwnerOrAdmin(viewer, row.user_id)

    const statusChanges = input.status !== undefined && input.status !== row.status
    if (statusChanges) assertNotModerated(viewer, row.previous_status, 'restaurarlo')

    const caps = await getUserCapabilities(trx, row.user_id)
    if (
      statusChanges &&
      !viewer.isAdmin &&
      countsTowardRequestLimit(input.status!) &&
      !countsTowardRequestLimit(row.status)
    ) {
      assertWithinLimit(caps, await countActive(trx, row.user_id, id), 'request')
    }

    const current = jsonArray<string>(row.photos)
    if (input.photos) {
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

    const { photos, accepted_conditions, ...fields } = input
    try {
      await trx
        .updateTable('requests')
        .set({
          ...fields,
          ...(fields.description !== undefined ? { description: fields.description || null } : {}),
          ...(fields.scale !== undefined ? { scale: fields.scale || null } : {}),
          ...(photos ? { photos: toJson(photos) } : {}),
          ...(accepted_conditions ? { accepted_conditions: toJson(accepted_conditions) } : {}),
        })
        .where('id', '=', id)
        .execute()
    } catch (err) {
      if (isMissingReference(err)) throw BAD_REFERENCE()
      throw err
    }
  })

  await deleteUploads(deps.uploadsDir, await unreferencedPhotos(db, removedPhotos))
  return getRequest(db, id, viewer)
}

export async function deleteRequest(deps: ContentDeps, viewer: Viewer, id: string) {
  const row = await deps.db
    .selectFrom('requests')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
  if (!row) throw notFound('Esta petición no existe.')
  assertOwnerOrAdmin(viewer, row.user_id)
  assertNotModerated(viewer, row.previous_status, 'eliminarlo')
  await deps.db.deleteFrom('requests').where('id', '=', id).execute()
  await deleteUploads(deps.uploadsDir, await unreferencedPhotos(deps.db, jsonArray(row.photos)))
}
