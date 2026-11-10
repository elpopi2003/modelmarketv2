import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { deleteAccount } from '../account/delete'
import * as adminContent from '../admin/content'
import * as reports from '../admin/reports'
import * as users from '../admin/users'
import { clearSessionCookie, requireAdmin, requireAuth } from '../auth/plugin'
import { sendContact } from '../contact'
import { viewerOf } from '../content/viewer'
import { accountDeletedEmail } from '../email/templates/account'
import { ok } from '../http/reply'
import { parse } from '../http/validate'

const idParam = z.object({ id: z.string().uuid('ID no válido') })
const kindParam = z.object({
  kind: z.enum(['listing', 'request']),
  id: z.string().uuid('ID no válido'),
})
const limit = (max: number, minutes: number) => ({
  config: { rateLimit: { max, timeWindow: minutes * 60_000 } },
})

const reportBody = z
  .object({
    listingId: z.string().uuid().nullish(),
    requestId: z.string().uuid().nullish(),
    reportedUserId: z.string().uuid().nullish(),
    reason: z.enum(['spam', 'prohibited', 'counterfeit', 'misleading', 'offensive', 'other'], {
      errorMap: () => ({ message: 'Elige un motivo' }),
    }),
    details: z.string().trim().max(1000, 'Máximo 1000 caracteres').nullish(),
  })
  .refine(
    (r) => [r.listingId, r.requestId, r.reportedUserId].filter(Boolean).length === 1,
    'Indica qué quieres denunciar',
  )

const contactBody = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80, 'Máximo 80 caracteres'),
  email: z
    .string()
    .trim()
    .min(1, 'El email es obligatorio')
    .max(120)
    .email('Introduce un email válido'),
  subject: z.string().trim().min(1, 'El asunto es obligatorio').max(120, 'Máximo 120 caracteres'),
  message: z
    .string()
    .trim()
    .min(1, 'El mensaje es obligatorio')
    .max(2000, 'Máximo 2000 caracteres'),
  recaptchaToken: z.string().max(5000).nullish(),
})

/** Administración, denuncias, formulario de contacto y baja de la propia cuenta. */
export const adminRoutes: FastifyPluginAsync = async (app) => {
  const { db, config } = app.deps
  const mail = { appUrl: config.APP_URL, logoUrl: config.MAIL_LOGO_URL }
  const accountDeps = { db, uploadsDir: config.UPLOADS_DIR, mail }
  const secure = config.NODE_ENV === 'production'

  // ── Público / usuario ─────────────────────────────────────────────────────
  app.post('/contact', limit(5, 60), async (req) => {
    const input = parse(contactBody, req.body)
    await sendContact(db, config, input, req.ip, req.log)
    return ok({ sent: true })
  })

  app.post('/reports', limit(20, 60), async (req) => {
    requireAuth(req)
    const input = parse(reportBody, req.body)
    return ok(await reports.createReport({ db, mail }, viewerOf(req)!, input))
  })

  app.delete('/account', limit(5, 15), async (req, reply) => {
    const { userId } = requireAuth(req)
    await deleteAccount(accountDeps, userId, accountDeletedEmail, 'account_deleted')
    clearSessionCookie(reply, secure)
    return ok({ deleted: true })
  })

  // ── Administración (todo exige rol admin) ─────────────────────────────────
  app.get('/admin/stats', async (req) => {
    requireAdmin(req)
    return ok(await adminContent.stats(db))
  })

  app.get('/admin/users', async (req) => {
    requireAdmin(req)
    return ok(await users.listUsers(db))
  })
  app.post('/admin/users/:id/suspend', async (req) => {
    const admin = requireAdmin(req)
    const { id } = parse(idParam, req.params)
    const { reason } = parse(
      z.object({
        reason: z
          .string({ required_error: 'Hace falta un motivo: se le envía a la persona por email' })
          .trim()
          .min(1, 'Hace falta un motivo: se le envía a la persona por email')
          .max(1000, 'Máximo 1000 caracteres'),
      }),
      req.body,
    )
    await users.suspendUser(accountDeps, admin.userId, id, reason)
    return ok({ suspended: true, emailSent: true, emailError: null })
  })
  app.post('/admin/users/:id/unsuspend', async (req) => {
    requireAdmin(req)
    const { id } = parse(idParam, req.params)
    await users.unsuspendUser(accountDeps, id)
    return ok({ suspended: false, emailSent: true, emailError: null })
  })
  app.delete('/admin/users/:id', async (req) => {
    const admin = requireAdmin(req)
    const { id } = parse(idParam, req.params)
    await users.deleteUserAsAdmin(accountDeps, admin.userId, id)
    return ok({ deleted: id, emailSent: true, emailError: null })
  })
  app.put('/admin/users/:id/admin', async (req) => {
    const admin = requireAdmin(req)
    const { id } = parse(idParam, req.params)
    const { makeAdmin } = parse(z.object({ makeAdmin: z.boolean() }), req.body)
    await users.setAdmin(db, admin.userId, id, makeAdmin)
    return ok({ isAdmin: makeAdmin })
  })

  app.get('/admin/listings', async (req) => {
    requireAdmin(req)
    return ok(await adminContent.allListings(db))
  })
  app.get('/admin/requests', async (req) => {
    requireAdmin(req)
    return ok(await adminContent.allRequests(db))
  })
  app.post('/admin/content/:kind/:id/take-down', async (req) => {
    requireAdmin(req)
    const { kind, id } = parse(kindParam, req.params)
    await adminContent.takeDown(db, kind, id)
    return ok({ takenDown: true })
  })
  app.post('/admin/content/:kind/:id/restore', async (req) => {
    requireAdmin(req)
    const { kind, id } = parse(kindParam, req.params)
    await adminContent.restore(db, kind, id)
    return ok({ restored: true })
  })

  app.get('/admin/reports', async (req) => {
    requireAdmin(req)
    const { status } = parse(
      z.object({ status: z.enum(['pending', 'resolved', 'dismissed']).optional() }),
      req.query,
    )
    return ok(await reports.listReports(db, status))
  })
  app.patch('/admin/reports/:id', async (req) => {
    const admin = requireAdmin(req)
    const { id } = parse(idParam, req.params)
    const { status, note } = parse(
      z.object({
        status: z.enum(['resolved', 'dismissed']),
        note: z.string().trim().max(1000).nullish(),
      }),
      req.body,
    )
    await reports.resolveReport(db, admin.userId, id, status, note)
    return ok({ status })
  })
}
