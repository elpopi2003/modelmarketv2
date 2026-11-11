import { sql } from 'kysely'
import type { Db } from '../db/client'
import type { ListingStatus } from '../db/schema'
import type { LayoutContext } from '../email/layout'
import { notify } from '../messaging/notifications'

/** Un aviso por semana como mucho por persona y anuncio (suspender/reactivar no hace spam). */
const RENOTIFY_DAYS = 7

/** El anuncio está en el catálogo: activo, reservado o vendido de escaparate. */
export function isInCatalog(row: { status: ListingStatus; sold_showcase: boolean }) {
  return (
    row.status === 'active' ||
    row.status === 'reserved' ||
    (row.status === 'sold' && Boolean(row.sold_showcase))
  )
}

/**
 * Estados con los que el dueño saca un anuncio del catálogo sin venderlo: «Suspender»
 * (archived) o volver a borrador. Venderlo o la retirada de un admin no avisan.
 */
export const isWithdrawalStatus = (s: ListingStatus) => s === 'archived' || s === 'draft'

/**
 * Avisa (campanita + email si lo tienen activado) a quienes guardaron el anuncio en
 * favoritos de que su dueño lo ha retirado o eliminado. Va dentro de la transacción del
 * cambio: el email entra en la cola solo si el cambio se confirma.
 */
export async function notifyFavoritersOfWithdrawal(
  deps: { db: Db; mail: LayoutContext },
  listing: { id: string; user_id: string; title: string },
  how: 'withdrawn' | 'deleted',
) {
  const { db } = deps
  let q = db
    .selectFrom('favorites')
    .select(['id', 'user_id'])
    .where('listing_id', '=', listing.id)
    .where('user_id', '!=', listing.user_id)
  if (how === 'withdrawn') {
    q = q.where((eb) =>
      eb.or([
        eb('withdrawal_notified_at', 'is', null),
        eb(
          'withdrawal_notified_at',
          '<',
          sql<Date>`NOW(3) - INTERVAL ${sql.lit(RENOTIFY_DAYS)} DAY`,
        ),
      ]),
    )
  }
  const fans = await q.execute()
  if (fans.length === 0) return 0

  const body =
    how === 'deleted'
      ? `«${listing.title}» ya no está en el catálogo: su vendedor lo ha eliminado.`
      : `«${listing.title}» ya no está en el catálogo: su vendedor lo ha retirado. Si vuelve a publicarlo, te aparecerá otra vez en Favoritos.`
  for (const fan of fans) {
    await notify(deps, {
      userId: fan.user_id,
      type: 'favorite_withdrawn',
      title: 'Una maqueta de tus favoritos ya no está disponible',
      body,
      link: '/explorar',
    })
  }
  if (how === 'withdrawn') {
    await db
      .updateTable('favorites')
      .set({ withdrawal_notified_at: sql<Date>`NOW(3)` })
      .where(
        'id',
        'in',
        fans.map((f) => f.id),
      )
      .execute()
  }
  return fans.length
}
