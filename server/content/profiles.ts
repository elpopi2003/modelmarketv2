import type { z } from 'zod'
import type { Db } from '../db/client'
import { isDuplicateKey } from '../db/errors'
import { badRequest, conflict, notFound } from '../http/reply'
import { deleteUploads, isOwnUpload, uploadExists } from '../uploads/images'
import type { profileUpdateSchema } from './schemas'

/** Lo que cualquiera puede ver de un perfil. Nunca email, roles ni preferencias. */
const PUBLIC_COLUMNS = [
  'id',
  'username',
  'display_name',
  'avatar_url',
  'location',
  'created_at',
] as const

export async function getPublicProfiles(db: Db, ids: string[]) {
  if (ids.length === 0) return []
  return db.selectFrom('profiles').select(PUBLIC_COLUMNS).where('id', 'in', ids).execute()
}

export async function getPublicProfile(db: Db, id: string) {
  const p = await db
    .selectFrom('profiles')
    .select(PUBLIC_COLUMNS)
    .where('id', '=', id)
    .executeTakeFirst()
  if (!p) throw notFound('Este perfil no existe.')
  return p
}

/** Perfil completo del propio usuario (incluye bio y preferencias de aviso). */
export async function getOwnProfile(db: Db, userId: string) {
  return db.selectFrom('profiles').selectAll().where('id', '=', userId).executeTakeFirstOrThrow()
}

export async function updateOwnProfile(
  db: Db,
  uploadsDir: string,
  userId: string,
  input: z.infer<typeof profileUpdateSchema>,
) {
  const current = await getOwnProfile(db, userId)

  if (input.avatar_url && input.avatar_url !== current.avatar_url) {
    if (
      !isOwnUpload(input.avatar_url, userId, 'avatars') ||
      !(await uploadExists(uploadsDir, input.avatar_url))
    ) {
      throw badRequest('El avatar no es válido. Vuelve a subirlo.', 'invalid_avatar')
    }
  }

  // Texto vacío = quitar el dato.
  const blankToNull = (v: string | null | undefined) =>
    v === undefined ? undefined : v?.trim() || null
  try {
    await db
      .updateTable('profiles')
      .set({
        display_name: blankToNull(input.display_name),
        username: blankToNull(input.username),
        location: blankToNull(input.location),
        bio: blankToNull(input.bio),
        notify_email: input.notify_email,
        notify_push: input.notify_push,
        avatar_url: input.avatar_url === undefined ? undefined : input.avatar_url || null,
      })
      .where('id', '=', userId)
      .execute()
  } catch (err) {
    if (isDuplicateKey(err))
      throw conflict('Ese nombre de usuario ya está en uso.', 'username_taken')
    throw err
  }

  // El avatar anterior ya no lo usa nadie: fuera del disco.
  if (
    input.avatar_url !== undefined &&
    current.avatar_url &&
    current.avatar_url !== input.avatar_url
  ) {
    if (isOwnUpload(current.avatar_url, userId, 'avatars'))
      await deleteUploads(uploadsDir, [current.avatar_url])
  }
  return getOwnProfile(db, userId)
}
