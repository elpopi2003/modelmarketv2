import { sql } from 'kysely'
import type { Db } from '../db/client'
import { toListingDto, toRequestDto } from '../content/dto'
import { badRequest, notFound } from '../http/reply'

export type ContentKind = 'listing' | 'request'

/** Cifras del panel. Misma forma que la RPC `admin_stats` de v2. */
export async function stats(db: Db) {
  const { rows } = await sql<Record<string, string>>`
    SELECT
      (SELECT COUNT(*) FROM profiles) AS users,
      (SELECT COUNT(*) FROM listings WHERE status IN ('active', 'reserved')) AS listings,
      (SELECT COUNT(*) FROM requests WHERE status = 'open') AS requests,
      (SELECT COUNT(*) FROM offers WHERE status = 'pending') AS offers,
      (SELECT COUNT(*) FROM reports WHERE status = 'pending') AS reports_pending
  `.execute(db)
  const r = rows[0]
  return {
    users: Number(r.users),
    listings: Number(r.listings),
    requests: Number(r.requests),
    offers: Number(r.offers),
    reports_pending: Number(r.reports_pending),
  }
}

/** Todo el contenido, en cualquier estado, para el panel de moderación. */
export async function allListings(db: Db) {
  const rows = await db.selectFrom('listings').selectAll().orderBy('created_at', 'desc').execute()
  return rows.map(toListingDto)
}

export async function allRequests(db: Db) {
  const rows = await db.selectFrom('requests').selectAll().orderBy('created_at', 'desc').execute()
  return rows.map(toRequestDto)
}

/**
 * Retira contenido guardando su estado anterior en `previous_status`, que es lo que marca
 * "retirado por moderación" (el dueño ya no puede reactivarlo ni borrarlo).
 *
 * Corrige un fallo de v2: si el dueño ya lo había suspendido (archivado/cerrado), v2 dejaba
 * previous_status a NULL y el contenido no quedaba marcado como moderado; el dueño podía
 * reactivarlo. Ahora se guarda el estado que tuviera, sea cual sea.
 */
export async function takeDown(db: Db, kind: ContentKind, id: string) {
  const r =
    kind === 'listing'
      ? await db
          .updateTable('listings')
          .set({ previous_status: sql`COALESCE(previous_status, status)`, status: 'archived' })
          .where('id', '=', id)
          .executeTakeFirst()
      : await db
          .updateTable('requests')
          .set({ previous_status: sql`COALESCE(previous_status, status)`, status: 'closed' })
          .where('id', '=', id)
          .executeTakeFirst()
  if (Number(r.numUpdatedRows) === 0) throw notFound('Ese contenido no existe.')
}

/** Devuelve el contenido al estado que tenía antes de retirarlo. */
export async function restore(db: Db, kind: ContentKind, id: string) {
  const table = kind === 'listing' ? 'listings' : 'requests'
  const row = await db
    .selectFrom(table)
    .select(['previous_status'])
    .where('id', '=', id)
    .executeTakeFirst()
  if (!row) throw notFound('Ese contenido no existe.')
  if (row.previous_status === null)
    throw badRequest('Este contenido no está retirado por moderación.')
  if (kind === 'listing') {
    await db
      .updateTable('listings')
      .set({ status: sql`previous_status`, previous_status: null })
      .where('id', '=', id)
      .execute()
  } else {
    await db
      .updateTable('requests')
      .set({ status: sql`previous_status`, previous_status: null })
      .where('id', '=', id)
      .execute()
  }
}
