import { randomUUID } from 'node:crypto'
import type { Db } from '../db/client'
import { isDuplicateKey } from '../db/errors'
import { notFound } from '../http/reply'
import { toListingDto } from './dto'
import { listingVisibleTo, type Viewer } from './viewer'

export async function listFavoriteIds(db: Db, userId: string) {
  const rows = await db
    .selectFrom('favorites')
    .select('listing_id')
    .where('user_id', '=', userId)
    .execute()
  return rows.map((r) => r.listing_id)
}

/** Anuncios favoritos que el usuario puede seguir viendo (los retirados desaparecen). */
export async function listFavoriteListings(db: Db, viewer: NonNullable<Viewer>) {
  const rows = await db
    .selectFrom('listings')
    .innerJoin('favorites', 'favorites.listing_id', 'listings.id')
    .selectAll('listings')
    .where('favorites.user_id', '=', viewer.userId)
    .where(listingVisibleTo(viewer))
    .orderBy('listings.created_at', 'desc')
    .execute()
  return rows.map(toListingDto)
}

/** Guarda en favoritos. Idempotente. Solo anuncios que el usuario puede ver. */
export async function addFavorite(db: Db, viewer: NonNullable<Viewer>, listingId: string) {
  const listing = await db
    .selectFrom('listings')
    .select(['id', 'user_id'])
    .where('id', '=', listingId)
    .where(listingVisibleTo(viewer))
    .executeTakeFirst()
  if (!listing) throw notFound('Este anuncio no existe o ya no está disponible.')
  try {
    await db
      .insertInto('favorites')
      .values({ id: randomUUID(), user_id: viewer.userId, listing_id: listingId })
      .execute()
  } catch (err) {
    if (isDuplicateKey(err)) return { created: false, ownerId: listing.user_id }
    throw err
  }
  return { created: true, ownerId: listing.user_id }
}

export async function removeFavorite(db: Db, userId: string, listingId: string) {
  await db
    .deleteFrom('favorites')
    .where('user_id', '=', userId)
    .where('listing_id', '=', listingId)
    .execute()
}
