import { sql } from 'kysely'
import { z } from 'zod'
import { conditionEnum } from '../content/schemas'
import { isInCatalog, notifyFavoritersOfRemoval } from '../content/withdrawal'
import type { Db } from '../db/client'
import { isMissingReference } from '../db/errors'
import { jsonArray } from '../db/json'
import { badRequest } from '../http/reply'
import type { LayoutContext } from '../email/layout'
import { deleteUploads, unreferencedPhotos } from '../uploads/images'

/** Tope por operación: de sobra para una colección importada, acotado para el servidor. */
export const BULK_MAX = 500

export const bulkIdsSchema = z
  .array(z.string().uuid('ID no válido'), { invalid_type_error: 'Selección no válida' })
  .min(1, 'No hay nada seleccionado')
  .max(BULK_MAX, `Como mucho ${BULK_MAX} anuncios por operación`)

/**
 * Cambios en bloque: solo se aplica lo que viene. `status` admite dos variantes de vendido:
 * «sold_showcase» (sigue en el catálogo con «¡VENDIDA!») y «sold» (sale del catálogo).
 */
export const bulkChangesSchema = z
  .object({
    status: z.enum(['active', 'reserved', 'sold_showcase', 'sold', 'archived']).optional(),
    category_id: z.string().uuid('La categoría no es válida').nullable().optional(),
    condition: conditionEnum.optional(),
    decals: z.enum(['perfect', 'yellowed', 'unavailable']).optional(),
    shipping_inpost: z.boolean().optional(),
    hand_delivery: z.boolean().optional(),
    accepts_offers: z.boolean().optional(),
    /** Ajuste de precio en %, p. ej. -10 = un 10 % más barato. */
    price_percent: z
      .number({ invalid_type_error: 'El ajuste de precio no es válido' })
      .int('El ajuste de precio debe ser un número entero')
      .min(-90, 'Como mucho un 90 % de rebaja')
      .max(500, 'Como mucho un 500 % de subida')
      .refine((n) => n !== 0, 'Un ajuste del 0 % no cambia nada')
      .optional(),
  })
  .refine((c) => Object.values(c).some((v) => v !== undefined), 'Elige al menos un cambio')

export type BulkChanges = z.infer<typeof bulkChangesSchema>

/**
 * Edita varios anuncios a la vez (panel de administración). El estado no se toca en lo
 * retirado por moderación: eso se devuelve con «Restaurar», que conserva su estado previo.
 */
export async function bulkUpdateListings(
  deps: { db: Db; mail: LayoutContext },
  ids: string[],
  changes: BulkChanges,
) {
  const { status, price_percent, ...fields } = changes
  return deps.db.transaction().execute(async (trx) => {
    const rows = await trx
      .selectFrom('listings')
      .select(['id', 'previous_status', 'status', 'sold_showcase'])
      .where('id', 'in', ids)
      .forUpdate()
      .execute()
    if (rows.length === 0) return { updated: 0, skippedModerated: 0 }
    const found = rows.map((r) => r.id)

    try {
      if (Object.keys(fields).length > 0 || price_percent !== undefined) {
        await trx
          .updateTable('listings')
          .set({
            ...fields,
            ...(price_percent !== undefined
              ? {
                  // Redondeo al céntimo, sin bajar de 0 ni pasar del máximo de un anuncio.
                  price_cents: sql<number>`LEAST(GREATEST(ROUND(price_cents * ${100 + price_percent} / 100), 0), 100000000)`,
                }
              : {}),
          })
          .where('id', 'in', found)
          .execute()
      }
    } catch (err) {
      if (isMissingReference(err)) throw badRequest('La categoría no existe.', 'invalid_reference')
      throw err
    }

    const movableRows = rows.filter((r) => r.previous_status === null)
    const movable = movableRows.map((r) => r.id)
    if (status !== undefined && movable.length > 0) {
      await trx
        .updateTable('listings')
        .set({
          status: status === 'sold_showcase' ? 'sold' : status,
          sold_showcase: status === 'sold_showcase',
        })
        .where('id', 'in', movable)
        .execute()
      // Suspender lo que estaba en el catálogo avisa a quien lo tenía en favoritos.
      if (status === 'archived') {
        await notifyFavoritersOfRemoval(
          { db: trx, mail: deps.mail },
          movableRows.filter(isInCatalog).map((r) => r.id),
          'withdrawn',
        )
      }
    }
    return {
      updated: rows.length,
      skippedModerated: status !== undefined ? rows.length - movable.length : 0,
    }
  })
}

/**
 * Elimina varios anuncios y las fotos del disco que ya no use nadie. Avisa antes a quien
 * los tenía en favoritos (un aviso por persona, con la lista de maquetas).
 */
export async function bulkDeleteListings(
  deps: { db: Db; uploadsDir: string; mail: LayoutContext },
  ids: string[],
) {
  const { db } = deps
  const rows = await db
    .selectFrom('listings')
    .select(['id', 'photos'])
    .where('id', 'in', ids)
    .execute()
  if (rows.length === 0) return { deleted: 0 }
  const found = rows.map((r) => r.id)
  await db.transaction().execute(async (trx) => {
    await notifyFavoritersOfRemoval({ db: trx, mail: deps.mail }, found, 'deleted')
    await trx.deleteFrom('listings').where('id', 'in', found).execute()
  })
  const photos = rows.flatMap((r) => jsonArray<string>(r.photos))
  await deleteUploads(deps.uploadsDir, await unreferencedPhotos(db, photos))
  return { deleted: rows.length }
}
