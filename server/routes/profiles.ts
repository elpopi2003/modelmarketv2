import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../auth/plugin'
import * as profiles from '../content/profiles'
import { idsQuerySchema, profileUpdateSchema } from '../content/schemas'
import { badRequest, ok } from '../http/reply'
import { parse } from '../http/validate'
import { MAX_UPLOAD_BYTES, saveAvatar, savePhoto } from '../uploads/images'

const idParam = z.object({ id: z.string().uuid('ID no válido') })

/** Perfiles (públicos y el propio) y subida de imágenes. */
export const profileRoutes: FastifyPluginAsync = async (app) => {
  const { db, config } = app.deps

  app.get('/profiles', async (req) => {
    const { ids } = parse(idsQuerySchema, req.query)
    return ok(await profiles.getPublicProfiles(db, ids))
  })
  app.get('/profiles/:id', async (req) => {
    const { id } = parse(idParam, req.params)
    return ok(await profiles.getPublicProfile(db, id))
  })

  app.get('/profile', async (req) => ok(await profiles.getOwnProfile(db, requireAuth(req).userId)))
  app.patch('/profile', async (req) => {
    const { userId } = requireAuth(req)
    return ok(
      await profiles.updateOwnProfile(
        db,
        config.UPLOADS_DIR,
        userId,
        parse(profileUpdateSchema, req.body),
      ),
    )
  })

  // Subidas: multipart con un único campo `file`. Devuelven la URL para guardarla después
  // en el anuncio, la petición o el perfil.
  const upload = (kind: 'photo' | 'avatar') => async (req: Parameters<typeof requireAuth>[0]) => {
    const { userId } = requireAuth(req)
    const file = await req.file({ limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } })
    if (!file) throw badRequest('Falta la imagen.')
    const buffer = await file.toBuffer()
    const saved =
      kind === 'photo'
        ? await savePhoto(config.UPLOADS_DIR, userId, buffer)
        : await saveAvatar(config.UPLOADS_DIR, userId, buffer)
    return ok(saved)
  }
  const uploadLimit = { config: { rateLimit: { max: 60, timeWindow: 15 * 60_000 } } }
  app.post('/uploads/photo', uploadLimit, upload('photo'))
  app.post('/uploads/avatar', uploadLimit, upload('avatar'))
}
