import type { FastifyRequest } from 'fastify'
import { sql, type ExpressionBuilder } from 'kysely'
import type { Database } from '../db/schema'

/** Quién hace la petición, a efectos de permisos sobre el contenido. */
export type Viewer = { userId: string; isAdmin: boolean } | null

export const viewerOf = (req: FastifyRequest): Viewer =>
  req.auth ? { userId: req.auth.userId, isAdmin: req.auth.isAdmin } : null

/**
 * El autor no está suspendido. Sustituye a `not is_suspended(user_id)` de las policies de
 * Postgres: el contenido de un suspendido desaparece del público, pero no se borra.
 */
export function authorNotSuspended(table: 'listings' | 'requests') {
  return sql<boolean>`NOT EXISTS (SELECT 1 FROM user_suspensions us WHERE us.user_id = ${sql.ref(`${table}.user_id`)})`
}

/** Anuncio visible para el público: activo o reservado, ya publicado y autor no suspendido. */
export function listingIsPublic(eb: ExpressionBuilder<Database, 'listings'>) {
  return eb.and([
    eb('listings.status', 'in', ['active', 'reserved']),
    eb('listings.visible_at', '<=', sql<Date>`NOW(3)`),
    authorNotSuspended('listings'),
  ])
}

/** Petición visible para el público: abierta y autor no suspendido. */
export function requestIsPublic(eb: ExpressionBuilder<Database, 'requests'>) {
  return eb.and([eb('requests.status', '=', 'open'), authorNotSuspended('requests')])
}

/**
 * Visible para este espectador: lo público, más todo lo suyo, y todo si es admin.
 * Equivale a las policies `*_select_public` de Postgres.
 */
export function listingVisibleTo(viewer: Viewer) {
  return (eb: ExpressionBuilder<Database, 'listings'>) => {
    if (viewer?.isAdmin) return eb.lit(true)
    if (viewer) return eb.or([listingIsPublic(eb), eb('listings.user_id', '=', viewer.userId)])
    return listingIsPublic(eb)
  }
}

export function requestVisibleTo(viewer: Viewer) {
  return (eb: ExpressionBuilder<Database, 'requests'>) => {
    if (viewer?.isAdmin) return eb.lit(true)
    if (viewer) return eb.or([requestIsPublic(eb), eb('requests.user_id', '=', viewer.userId)])
    return requestIsPublic(eb)
  }
}
