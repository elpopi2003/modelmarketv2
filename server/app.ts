import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Config } from './config'
import type { Db } from './db/client'
import rateLimit from '@fastify/rate-limit'
import { authPlugin } from './auth/plugin'
import { HttpError, fail, forbidden } from './http/reply'
import { adminRoutes } from './routes/admin'
import { authRoutes } from './routes/auth'
import { contentRoutes } from './routes/content'
import { healthRoutes } from './routes/health'
import { importRoutes } from './routes/import'
import { messagingRoutes } from './routes/messaging'
import { profileRoutes } from './routes/profiles'
import { MAX_UPLOAD_BYTES } from './uploads/images'
import { configureTiers } from './content/tier'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export type AppDeps = { config: Config; db: Db }

declare module 'fastify' {
  interface FastifyInstance {
    deps: AppDeps
  }
}

/**
 * Construye la aplicación sin ponerla a escuchar. `index.ts` la arranca; los tests la
 * usan con `app.inject(...)`, sin abrir puertos.
 */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config } = deps
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: config.LOG_LEVEL },
    // Detrás del nginx de Plesk: la IP real del cliente viene en X-Forwarded-For.
    trustProxy: config.NODE_ENV === 'production',
    bodyLimit: 1024 * 1024,
  })
  app.decorate('deps', deps)
  configureTiers({ betaAllPro: config.BETA_ALL_PRO })

  await app.register(cookie)
  // Límites por IP solo en las rutas que los declaran (login, alta, recuperación…). En
  // tests se desactivan: todas las peticiones salen de la misma IP.
  if (config.NODE_ENV !== 'test') {
    await app.register(rateLimit, { global: false, enableDraftSpec: true })
  }

  // Errores → formato { ok:false, error } con el status adecuado. Los inesperados se
  // registran completos en el log pero al cliente solo le llega un mensaje genérico.
  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.status).send(fail(err.code, err.message))
    }
    if (err.statusCode === 429) {
      return reply
        .status(429)
        .send(
          fail(
            'rate_limited',
            'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.',
          ),
        )
    }
    if (err.statusCode === 413) {
      const mb = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)
      return reply
        .status(413)
        .send(fail('too_large', `La imagen pesa demasiado (máximo ${mb} MB).`))
    }
    if (err.validation || (err.statusCode && err.statusCode >= 400 && err.statusCode < 500)) {
      return reply.status(err.statusCode ?? 400).send(fail('bad_request', 'Petición no válida.'))
    }
    req.log.error(err)
    return reply
      .status(500)
      .send(fail('internal', 'Ha ocurrido un error inesperado. Inténtalo de nuevo.'))
  })

  // Protección CSRF: la cookie de sesión es SameSite=Lax y además se rechaza cualquier
  // petición que modifique datos si viene de otro origen. Los navegadores siempre envían
  // `Origin` en peticiones cross-site; sin él es un cliente que no es un navegador.
  const appOrigin = new URL(config.APP_URL).origin
  app.addHook('onRequest', async (req) => {
    if (SAFE_METHODS.has(req.method) || !req.url.startsWith('/api/')) return
    const origin = req.headers.origin
    if (origin && origin !== appOrigin) throw forbidden('Origen no permitido.')
  })

  await app.register(
    async (api) => {
      await api.register(authPlugin)
      await api.register(healthRoutes)
      await api.register(authRoutes)
      await api.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 } })
      await api.register(contentRoutes)
      await api.register(profileRoutes)
      await api.register(messagingRoutes)
      await api.register(adminRoutes)
      await api.register(importRoutes)
      api.setNotFoundHandler((_req, reply) =>
        reply.status(404).send(fail('not_found', 'Ruta no encontrada.')),
      )
    },
    { prefix: '/api' },
  )

  // Fotos y avatares subidos. Los nombres son UUID que nunca se reutilizan, así que se
  // pueden cachear para siempre.
  const uploadsDir = resolve(config.UPLOADS_DIR)
  mkdirSync(uploadsDir, { recursive: true })
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
    index: false,
    maxAge: '365d',
    immutable: true,
  })

  // En producción el mismo proceso sirve la SPA compilada. Cualquier ruta que no sea
  // /api ni un fichero existente devuelve index.html (React Router decide la página).
  const staticDir = config.STATIC_DIR ? resolve(config.STATIC_DIR) : ''
  if (staticDir && existsSync(staticDir)) {
    await app.register(fastifyStatic, { root: staticDir, wildcard: false })
    app.setNotFoundHandler((req, reply) => {
      if (req.method !== 'GET' || req.url.startsWith('/api/') || req.url.startsWith('/uploads/')) {
        return reply.status(404).send(fail('not_found', 'Ruta no encontrada.'))
      }
      return reply.sendFile('index.html')
    })
  }

  return app
}
