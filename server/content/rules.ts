import { isUnlimited, type TierCapabilities } from '@/lib/subscription'
import { HttpError, badRequest } from '../http/reply'
import { isOwnUpload, uploadExists } from '../uploads/images'
import type { Viewer } from './viewer'

/**
 * Reglas comunes de anuncios y peticiones. Sustituyen a las policies RLS y a los triggers
 * `prevent_moderated_*` de Postgres.
 */

/** Solo el dueño o un admin pueden modificar o borrar. Al resto se le responde 404. */
export function assertOwnerOrAdmin(
  viewer: Viewer,
  ownerId: string,
): asserts viewer is NonNullable<Viewer> {
  if (!viewer || (!viewer.isAdmin && viewer.userId !== ownerId)) {
    throw new HttpError(404, 'not_found', 'No encontrado.')
  }
}

/** La moderación manda: con `previous_status` puesto, el dueño no cambia el estado ni borra. */
export function assertNotModerated(
  viewer: NonNullable<Viewer>,
  previousStatus: string | null,
  action: 'restaurarlo' | 'eliminarlo',
) {
  if (previousStatus !== null && !viewer.isAdmin) {
    throw new HttpError(
      403,
      'moderated',
      `Contenido retirado por moderación: solo un administrador puede ${action}.`,
    )
  }
}

/** Límite de anuncios/peticiones activos del plan. */
export function assertWithinLimit(
  caps: TierCapabilities,
  current: number,
  kind: 'listing' | 'request',
) {
  const max = kind === 'listing' ? caps.maxListings : caps.maxRequests
  if (isUnlimited(max) || current < max) return
  const what =
    kind === 'listing'
      ? max === 1
        ? '1 anuncio activo'
        : `${max} anuncios activos`
      : max === 1
        ? '1 petición activa'
        : `${max} peticiones activas`
  throw new HttpError(
    403,
    'plan_limit',
    `Tu plan ${caps.label} permite ${what}. Pásate a PRO para publicar sin límite.`,
  )
}

/**
 * Fotos de un anuncio o petición: como mucho las del plan, y cada una debe ser una subida
 * del propio dueño que exista en disco, o una que ya tenía (las migradas de Supabase).
 */
export async function assertPhotosAllowed(opts: {
  photos: string[]
  ownerId: string
  existing: string[]
  maxPhotos: number
  uploadsDir: string
  bypassLimit?: boolean
}) {
  const { photos, ownerId, existing, maxPhotos, uploadsDir } = opts
  if (!opts.bypassLimit && !isUnlimited(maxPhotos) && photos.length > maxPhotos) {
    throw new HttpError(
      403,
      'photo_limit',
      `Tu plan permite hasta ${maxPhotos} fotos. Quita alguna o pásate a PRO.`,
    )
  }
  if (new Set(photos).size !== photos.length) throw badRequest('Hay fotos repetidas.')
  for (const url of photos) {
    if (existing.includes(url)) continue
    if (!isOwnUpload(url, ownerId, 'photos') || !(await uploadExists(uploadsDir, url))) {
      throw badRequest('Alguna foto no es válida. Vuelve a subirla.', 'invalid_photo')
    }
  }
}

/** Escapa `%` y `_` para usar texto del usuario dentro de un LIKE. */
export const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
