import { sql } from 'kysely'
import type { Db } from '../db/client'
import type { ListingStatus } from '../db/schema'
import type { LayoutContext } from '../email/layout'
import { notify } from '../messaging/notifications'

/** Un aviso por semana como mucho por persona y anuncio (suspender/reactivar no hace spam). */
const RENOTIFY_DAYS = 7
/** Títulos que se citan en un aviso agrupado; el resto se resume en «y N más». */
const TITLES_IN_NOTICE = 5

/** El anuncio está en el catálogo: activo, reservado o vendido de escaparate. */
export function isInCatalog(row: { status: ListingStatus; sold_showcase: boolean }) {
  return (
    row.status === 'active' ||
    row.status === 'reserved' ||
    (row.status === 'sold' && Boolean(row.sold_showcase))
  )
}

/**
 * Estados con los que se saca un anuncio del catálogo sin venderlo: «Suspender»
 * (archived) o volver a borrador. Venderlo o la retirada por moderación no avisan.
 */
export const isWithdrawalStatus = (s: ListingStatus) => s === 'archived' || s === 'draft'

const quoted = (titles: string[]) => {
  const shown = titles.slice(0, TITLES_IN_NOTICE).map((t) => `«${t}»`)
  const rest = titles.length - shown.length
  return rest > 0 ? `${shown.join(', ')} y ${rest} más` : shown.join(', ')
}

function noticeText(titles: string[], how: 'withdrawn' | 'deleted') {
  if (titles.length === 1) {
    return {
      title: 'Una maqueta de tus favoritos ya no está disponible',
      body:
        how === 'deleted'
          ? `«${titles[0]}» se ha eliminado y ya no está en el catálogo.`
          : `«${titles[0]}» se ha retirado del catálogo. Si vuelve a publicarse, te aparecerá otra vez en Favoritos.`,
    }
  }
  return {
    title: `${titles.length} maquetas de tus favoritos ya no están disponibles`,
    body:
      how === 'deleted'
        ? `Se han eliminado y ya no están en el catálogo: ${quoted(titles)}.`
        : `Se han retirado del catálogo: ${quoted(titles)}. Si vuelven a publicarse, te aparecerán otra vez en Favoritos.`,
  }
}

/**
 * Avisa (campanita + email si lo tienen activado) a quienes guardaron estos anuncios en
 * favoritos de que se han retirado del catálogo o eliminado. Cada persona recibe un único
 * aviso, aunque la operación afecte a varios de sus favoritos. Nunca se avisa al dueño.
 *
 * Va dentro de la transacción del cambio, y en un borrado ANTES de borrar (el borrado se
 * lleva los favoritos por la clave foránea): el email entra en la cola solo si se confirma.
 */
export async function notifyFavoritersOfRemoval(
  deps: { db: Db; mail: LayoutContext },
  listingIds: string[],
  how: 'withdrawn' | 'deleted',
) {
  if (listingIds.length === 0) return 0
  const { db } = deps
  let q = db
    .selectFrom('favorites as f')
    .innerJoin('listings as l', 'l.id', 'f.listing_id')
    .select(['f.id', 'f.user_id', 'l.title'])
    .where('f.listing_id', 'in', listingIds)
    .whereRef('f.user_id', '!=', 'l.user_id')
    .orderBy('l.title')
  if (how === 'withdrawn') {
    q = q.where((eb) =>
      eb.or([
        eb('f.withdrawal_notified_at', 'is', null),
        eb(
          'f.withdrawal_notified_at',
          '<',
          sql<Date>`NOW(3) - INTERVAL ${sql.lit(RENOTIFY_DAYS)} DAY`,
        ),
      ]),
    )
  }
  const rows = await q.execute()
  if (rows.length === 0) return 0

  const byFan = new Map<string, string[]>()
  for (const r of rows) byFan.set(r.user_id, [...(byFan.get(r.user_id) ?? []), r.title])
  for (const [userId, titles] of byFan) {
    await notify(deps, {
      userId,
      type: 'favorite_withdrawn',
      link: '/explorar',
      ...noticeText(titles, how),
    })
  }

  if (how === 'withdrawn') {
    await db
      .updateTable('favorites')
      .set({ withdrawal_notified_at: sql<Date>`NOW(3)` })
      .where(
        'id',
        'in',
        rows.map((r) => r.id),
      )
      .execute()
  }
  return byFan.size
}
