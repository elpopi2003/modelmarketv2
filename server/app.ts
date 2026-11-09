import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import fastifyStatic from '@fastify/static'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Config } from './config'
import type { Db } from './db/client'
import { HttpError, fail } from './http/reply'
import { healthRoutes } from './routes/health'

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

  await app.register(cookie)

  // Errores → formato { ok:false, error } con el status adecuado. Los inesperados se
  // registran completos en el log pero al cliente solo le llega un mensaje genérico.
  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.status).send(fail(err.code, err.message))
    }
    if (err.validation) {
      return reply.status(400).send(fail('bad_request', err.message))
    }
    req.log.error(err)
    return reply
      .status(500)
      .send(fail('internal', 'Ha ocurrido un error inesperado. Inténtalo de nuevo.'))
  })

  await app.register(
    async (api) => {
      await api.register(healthRoutes)
      api.setNotFoundHandler((_req, reply) =>
        reply.status(404).send(fail('not_found', 'Ruta no encontrada.')),
      )
    },
    { prefix: '/api' },
  )

  // En producción el mismo proceso sirve la SPA compilada. Cualquier ruta que no sea
  // /api ni un fichero existente devuelve index.html (React Router decide la página).
  const staticDir = config.STATIC_DIR ? resolve(config.STATIC_DIR) : ''
  if (staticDir && existsSync(staticDir)) {
    await app.register(fastifyStatic, { root: staticDir, wildcard: false })
    app.setNotFoundHandler((req, reply) => {
      if (req.method !== 'GET' || req.url.startsWith('/api/')) {
        return reply.status(404).send(fail('not_found', 'Ruta no encontrada.'))
      }
      return reply.sendFile('index.html')
    })
  }

  return app
}
