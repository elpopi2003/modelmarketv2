import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import type { Db } from '../db/client'
import { isDuplicateKey } from '../db/errors'
import type { ReportReason, ReportStatus } from '../db/schema'
import { listingVisibleTo, requestVisibleTo, type Viewer } from '../content/viewer'
import { HttpError, badRequest, notFound } from '../http/reply'
import { notify, type MessagingDeps } from '../messaging/notifications'
import { resolvePeople } from '../messaging/subjects'

export interface CreateReportInput {
  listingId?: string | null
  requestId?: string | null
  reportedUserId?: string | null
  reason: ReportReason
  details?: string | null
}

const WHAT = { listing: 'un anuncio', request: 'una petición', user: 'un usuario' } as const

/**
 * Denuncia de un usuario sobre un anuncio, una petición o un usuario. Solo sobre lo que
 * puede ver, nunca sobre lo propio, y una sola pendiente por objetivo. Avisa a todos los
 * administradores (como el trigger `notify_admins_on_report` de v2).
 */
export async function createReport(
  deps: MessagingDeps,
  viewer: NonNullable<Viewer>,
  input: CreateReportInput,
) {
  const { db } = deps
  const targets = [input.listingId, input.requestId, input.reportedUserId].filter(Boolean)
  if (targets.length !== 1) throw badRequest('Indica qué quieres denunciar.')
  let kind: keyof typeof WHAT

  if (input.listingId) {
    kind = 'listing'
    const l = await db
      .selectFrom('listings')
      .select('user_id')
      .where('id', '=', input.listingId)
      .where(listingVisibleTo(viewer))
      .executeTakeFirst()
    if (!l) throw notFound('Este anuncio no existe o ya no está disponible.')
    if (l.user_id === viewer.userId) throw badRequest('No puedes denunciar tu propio anuncio.')
  } else if (input.requestId) {
    kind = 'request'
    const r = await db
      .selectFrom('requests')
      .select('user_id')
      .where('id', '=', input.requestId)
      .where(requestVisibleTo(viewer))
      .executeTakeFirst()
    if (!r) throw notFound('Esta petición no existe o ya no está disponible.')
    if (r.user_id === viewer.userId) throw badRequest('No puedes denunciar tu propia petición.')
  } else {
    kind = 'user'
    if (input.reportedUserId === viewer.userId)
      throw badRequest('No puedes denunciarte a ti mismo.')
    const u = await db
      .selectFrom('users')
      .select('id')
      .where('id', '=', input.reportedUserId!)
      .executeTakeFirst()
    if (!u) throw notFound('Ese usuario no existe.')
  }

  const id = randomUUID()
  await db.transaction().execute(async (trx) => {
    try {
      await trx
        .insertInto('reports')
        .values({
          id,
          reporter_id: viewer.userId,
          listing_id: input.listingId ?? null,
          request_id: input.requestId ?? null,
          reported_user_id: input.reportedUserId ?? null,
          reason: input.reason,
          details: input.details?.trim() || null,
          resolved_by: null,
          resolved_at: null,
          resolution_note: null,
        })
        .execute()
    } catch (err) {
      if (isDuplicateKey(err)) {
        throw new HttpError(409, 'already_reported', 'Ya lo has denunciado: lo estamos revisando.')
      }
      throw err
    }
    const admins = await trx
      .selectFrom('user_roles')
      .select('user_id')
      .where('role', '=', 'admin')
      .execute()
    for (const a of admins) {
      await notify(
        { ...deps, db: trx },
        {
          userId: a.user_id,
          type: 'report',
          title: `Nuevo reporte sobre ${WHAT[kind]}`,
          body: `Motivo: ${input.reason}`,
          link: '/admin/reportes',
        },
      )
    }
  })
  return getReport(db, id)
}

const getReport = (db: Db, id: string) =>
  db
    .selectFrom('reports')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
    .then(toReportDto)

function toReportDto<T extends { pending_key?: unknown }>(r: T) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pending_key, ...rest } = r
  return rest
}

/** Cola de moderación con el contexto de cada denuncia. Misma forma que en v2. */
export async function listReports(db: Db, status?: ReportStatus) {
  let q = db.selectFrom('reports').selectAll().orderBy('created_at', 'desc')
  if (status) q = q.where('status', '=', status)
  const reports = await q.execute()
  if (reports.length === 0) return []

  const ids = (k: 'listing_id' | 'request_id') => [
    ...new Set(reports.map((r) => r[k]).filter((x): x is string => !!x)),
  ]
  const [listings, requests] = await Promise.all([
    ids('listing_id').length
      ? db
          .selectFrom('listings')
          .select(['id', 'title'])
          .where('id', 'in', ids('listing_id'))
          .execute()
      : [],
    ids('request_id').length
      ? db
          .selectFrom('requests')
          .select(['id', 'title'])
          .where('id', 'in', ids('request_id'))
          .execute()
      : [],
  ])
  const lmap = new Map(listings.map((l) => [l.id, l.title]))
  const rmap = new Map(requests.map((r) => [r.id, r.title]))
  const person = await resolvePeople(db, [
    ...reports.map((r) => r.reporter_id),
    ...reports.map((r) => r.reported_user_id).filter((x): x is string => !!x),
  ])

  return reports.map((r) => {
    const base = { report: toReportDto(r), reporterName: person(r.reporter_id).name }
    if (r.listing_id) {
      return {
        ...base,
        targetKind: 'listing' as const,
        targetTitle: lmap.get(r.listing_id) ?? 'Anuncio eliminado',
        targetLink: `/producto/${r.listing_id}`,
      }
    }
    if (r.request_id) {
      return {
        ...base,
        targetKind: 'request' as const,
        targetTitle: rmap.get(r.request_id) ?? 'Petición eliminada',
        targetLink: `/peticion/${r.request_id}`,
      }
    }
    return {
      ...base,
      targetKind: 'user' as const,
      targetTitle: r.reported_user_id ? person(r.reported_user_id).name : 'Usuario',
      targetLink: null,
    }
  })
}

export async function resolveReport(
  db: Db,
  adminId: string,
  reportId: string,
  status: 'resolved' | 'dismissed',
  note?: string | null,
) {
  const r = await db
    .updateTable('reports')
    .set({
      status,
      resolved_by: adminId,
      resolved_at: sql<Date>`NOW(3)`,
      resolution_note: note?.trim() || null,
    })
    .where('id', '=', reportId)
    .executeTakeFirst()
  if (Number(r.numUpdatedRows) === 0) throw notFound('Esa denuncia no existe.')
}
