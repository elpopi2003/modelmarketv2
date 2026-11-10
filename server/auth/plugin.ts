import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { forbidden, unauthorized } from '../http/reply'
import { SESSION_COOKIE, resolveSession, type SessionAuth } from './sessions'

declare module 'fastify' {
  interface FastifyRequest {
    /** Sesión del usuario, o null si es un visitante. */
    auth: SessionAuth | null
  }
}

/**
 * Lee la cookie de sesión en cada petición y deja `req.auth` resuelto. Las rutas deciden
 * qué hacer con un visitante: `requireAuth(req)` lanza 401 si no hay sesión.
 */
export const authPlugin: FastifyPluginAsync = fp(async (app) => {
  app.decorateRequest('auth', null)
  app.addHook('onRequest', async (req) => {
    const token = req.cookies[SESSION_COOKIE]
    if (!token) return
    req.auth = await resolveSession(app.deps.db, token, app.deps.config.SESSION_TTL_DAYS)
  })
})

export function requireAuth(req: FastifyRequest): SessionAuth {
  if (!req.auth) throw unauthorized()
  return req.auth
}

export function setSessionCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: Date,
  secure: boolean,
) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export function clearSessionCookie(reply: FastifyReply, secure: boolean) {
  reply.clearCookie(SESSION_COOKIE, { httpOnly: true, secure, sameSite: 'lax', path: '/' })
}

/** Exige sesión de administrador. El rol se resuelve en el servidor, nunca lo dice el cliente. */
export function requireAdmin(req: FastifyRequest): SessionAuth {
  const auth = requireAuth(req)
  if (!auth.isAdmin) throw forbidden('Solo administradores.')
  return auth
}
