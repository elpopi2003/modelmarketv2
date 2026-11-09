import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { clearSessionCookie, requireAuth, setSessionCookie } from '../auth/plugin'
import * as auth from '../auth/service'
import { SESSION_COOKIE, deleteSession } from '../auth/sessions'
import { ok } from '../http/reply'
import { parse } from '../http/validate'

const email = z
  .string({ required_error: 'El email es obligatorio' })
  .trim()
  .min(1, 'El email es obligatorio')
  .max(254, 'El email es demasiado largo')
  .email('Introduce un email válido')
const newPassword = z
  .string({ required_error: 'La contraseña es obligatoria' })
  .min(8, 'Mínimo 8 caracteres')
  .max(200, 'Máximo 200 caracteres')
const token = z
  .string({ required_error: 'Falta el enlace' })
  .min(20, 'El enlace no es válido')
  .max(100)

const credentials = z.object({
  email,
  password: z
    .string({ required_error: 'La contraseña es obligatoria' })
    .min(1, 'La contraseña es obligatoria')
    .max(200),
})

// Límite por IP en las rutas que se pueden usar para fuerza bruta o para mandar correos.
const limit = (max: number, minutes: number) => ({
  config: { rateLimit: { max, timeWindow: minutes * 60_000 } },
})

const meta = (req: FastifyRequest) => ({ ip: req.ip, userAgent: req.headers['user-agent'] ?? null })

export const authRoutes: FastifyPluginAsync = async (app) => {
  const { db, config } = app.deps
  const deps = { db, config }
  const secure = config.NODE_ENV === 'production'

  app.get('/auth/me', async (req) => {
    return ok(req.auth ? await auth.currentUser(db, req.auth.userId) : null)
  })

  app.post('/auth/register', limit(5, 15), async (req) => {
    const body = parse(z.object({ email, password: newPassword }), req.body)
    return ok(await auth.register(deps, body))
  })

  app.post('/auth/verify-email', limit(10, 15), async (req) => {
    const body = parse(z.object({ token }), req.body)
    await auth.verifyEmail(deps, body.token)
    return ok({ verified: true })
  })

  app.post('/auth/resend-verification', limit(3, 15), async (req) => {
    const body = parse(z.object({ email }), req.body)
    await auth.resendVerification(deps, body.email)
    return ok({ sent: true })
  })

  app.post('/auth/login', limit(10, 15), async (req, reply) => {
    const body = parse(credentials, req.body)
    const session = await auth.login(deps, body, meta(req))
    setSessionCookie(reply, session.token, session.expiresAt, secure)
    return ok(await auth.currentUser(db, session.userId))
  })

  app.post('/auth/logout', async (req, reply) => {
    const t = req.cookies[SESSION_COOKIE]
    if (t) await deleteSession(db, t)
    clearSessionCookie(reply, secure)
    return ok({ loggedOut: true })
  })

  app.post('/auth/forgot-password', limit(5, 15), async (req) => {
    const body = parse(z.object({ email }), req.body)
    await auth.requestPasswordReset(deps, body.email)
    return ok({ sent: true })
  })

  app.post('/auth/reset-password', limit(10, 15), async (req, reply) => {
    const body = parse(z.object({ token, password: newPassword }), req.body)
    const session = await auth.resetPassword(deps, body.token, body.password, meta(req))
    if (session) setSessionCookie(reply, session.token, session.expiresAt, secure)
    return ok({ loggedIn: session !== null })
  })

  app.post('/auth/change-password', limit(10, 15), async (req) => {
    const a = requireAuth(req)
    const body = parse(z.object({ password: newPassword }), req.body)
    await auth.changePassword(deps, a, body.password)
    return ok({ changed: true })
  })
}
