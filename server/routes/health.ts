import type { FastifyPluginAsync } from 'fastify'
import { pingDb } from '../db/client'
import { ok, fail } from '../http/reply'

/**
 * GET /api/health — comprobación para monitorización y para el despliegue en Plesk:
 * 200 si el proceso y la base de datos responden, 503 si la base de datos no.
 */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_req, reply) => {
    const db = await pingDb(app.deps.db)
    if (!db) return reply.status(503).send(fail('db_unavailable', 'La base de datos no responde.'))
    return ok({ status: 'ok', db: true, version: process.env.npm_package_version ?? null })
  })
}
