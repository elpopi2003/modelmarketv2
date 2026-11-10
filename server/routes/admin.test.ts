import { randomUUID } from 'node:crypto'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../db/client'
import {
  TEST_DB_URL,
  TEST_ORIGIN,
  createTestUser,
  resetTestDb,
  tempUploadsDir,
  testApp,
} from '../test/helpers'

describe.skipIf(!TEST_DB_URL)('API de administración, denuncias, contacto y baja', () => {
  let db: Db
  let app: FastifyInstance
  let uploadsDir: string

  beforeAll(async () => {
    db = await resetTestDb()
    uploadsDir = await tempUploadsDir()
    app = await testApp(db, { UPLOADS_DIR: uploadsDir })
  })
  afterAll(async () => {
    await app?.close()
    await db?.destroy()
    if (uploadsDir) await rm(uploadsDir, { recursive: true, force: true })
  })
  beforeEach(async () => {
    await db.deleteFrom('email_outbox').execute()
    await db.deleteFrom('reports').execute()
    await db.deleteFrom('users').execute()
  })
  afterEach(() => vi.unstubAllGlobals())

  type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  const call = (method: Method, url: string, cookie?: string, payload?: object) =>
    app.inject({
      method,
      url: `/api${url}`,
      payload,
      headers: { origin: TEST_ORIGIN, ...(cookie ? { cookie } : {}) },
    })
  const data = async (p: ReturnType<typeof call>) => (await p).json().data
  const emails = (kind: string) =>
    db.selectFrom('email_outbox').selectAll().where('kind', '=', kind).execute()

  async function listing(userId: string, extra: Record<string, unknown> = {}) {
    const id = randomUUID()
    await db
      .insertInto('listings')
      .values({
        id,
        user_id: userId,
        title: 'Hasegawa Zero 1:48',
        description: null,
        price_cents: 2000,
        condition: 'sealed',
        decals: 'perfect',
        scale: '1:48',
        category_id: null,
        brand_id: null,
        photos: '[]',
        previous_status: null,
        visible_at: new Date(Date.now() - 1000),
        ...extra,
      })
      .execute()
    return id
  }

  // ── acceso ────────────────────────────────────────────────────────────────
  it('el panel exige rol admin: 401 sin sesión, 403 con sesión de usuario', async () => {
    const user = await createTestUser(db)
    for (const url of ['/admin/stats', '/admin/users', '/admin/listings', '/admin/reports']) {
      expect((await call('GET', url)).statusCode, url).toBe(401)
      expect((await call('GET', url, user.cookie)).statusCode, url).toBe(403)
    }
  })

  it('estadísticas y listado de usuarios con email, rol, actividad y suspensión', async () => {
    const admin = await createTestUser(db, { admin: true })
    const seller = await createTestUser(db, { tier: 'pro' })
    await listing(seller.id)
    expect(await data(call('GET', '/admin/stats', admin.cookie))).toMatchObject({
      users: 2,
      listings: 1,
      requests: 0,
      reports_pending: 0,
    })
    const list = await data(call('GET', '/admin/users', admin.cookie))
    const row = list.find((u: { id: string }) => u.id === seller.id)
    expect(row).toMatchObject({
      email: seller.email,
      is_admin: false,
      tier: 'pro',
      listings_count: 1,
      suspended_at: null,
    })
  })

  // ── suspensión ────────────────────────────────────────────────────────────
  it('suspender: exige motivo, echa de las sesiones, oculta su contenido y avisa por email', async () => {
    const admin = await createTestUser(db, { admin: true })
    const u = await createTestUser(db)
    const l = await listing(u.id)

    const noReason = await call('POST', `/admin/users/${u.id}/suspend`, admin.cookie, {
      reason: '  ',
    })
    expect(noReason.statusCode).toBe(400)

    await call('POST', `/admin/users/${u.id}/suspend`, admin.cookie, { reason: 'Spam reiterado' })
    expect((await call('GET', '/auth/me', u.cookie)).json().data).toBeNull()
    expect((await call('GET', `/listings/${l}`)).statusCode).toBe(404)
    const [mail] = await emails('account_suspended')
    expect(mail.to_email).toBe(u.email)
    expect(mail.html).toContain('Spam reiterado')

    const row = (await data(call('GET', '/admin/users', admin.cookie))).find(
      (x: { id: string }) => x.id === u.id,
    )
    expect(row.suspension_reason).toBe('Spam reiterado')

    await call('POST', `/admin/users/${u.id}/unsuspend`, admin.cookie)
    expect((await call('GET', `/listings/${l}`)).statusCode).toBe(200)
    expect(await emails('account_reinstated')).toHaveLength(1)
    expect((await call('POST', `/admin/users/${u.id}/unsuspend`, admin.cookie)).statusCode).toBe(
      400,
    )
  })

  it('no se puede suspender a uno mismo ni a otro administrador', async () => {
    const admin = await createTestUser(db, { admin: true })
    const other = await createTestUser(db, { admin: true })
    const body = { reason: 'x' }
    expect(
      (await call('POST', `/admin/users/${admin.id}/suspend`, admin.cookie, body)).statusCode,
    ).toBe(400)
    expect(
      (await call('POST', `/admin/users/${other.id}/suspend`, admin.cookie, body)).statusCode,
    ).toBe(400)
  })

  // ── roles ─────────────────────────────────────────────────────────────────
  it('roles: dar y quitar admin; nadie se lo quita a sí mismo y siempre queda uno', async () => {
    const admin = await createTestUser(db, { admin: true })
    const u = await createTestUser(db)
    await call('PUT', `/admin/users/${u.id}/admin`, admin.cookie, { makeAdmin: true })
    expect((await call('GET', '/auth/me', u.cookie)).json().data.isAdmin).toBe(true)

    expect(
      (await call('PUT', `/admin/users/${admin.id}/admin`, admin.cookie, { makeAdmin: false }))
        .statusCode,
    ).toBe(400)
    expect(
      (await call('PUT', `/admin/users/${u.id}/admin`, admin.cookie, { makeAdmin: false }))
        .statusCode,
    ).toBe(200)
    expect((await call('GET', '/auth/me', u.cookie)).json().data.isAdmin).toBe(false)
  })

  // ── moderación de contenido ───────────────────────────────────────────────
  it('retirar algo que el dueño ya había suspendido lo deja marcado como moderado (fallo de v2)', async () => {
    const admin = await createTestUser(db, { admin: true })
    const owner = await createTestUser(db, { tier: 'pro' })
    const l = await listing(owner.id, { status: 'archived' }) // suspendido por su dueño

    await call('POST', `/admin/content/listing/${l}/take-down`, admin.cookie)
    const after = await db
      .selectFrom('listings')
      .select(['status', 'previous_status'])
      .where('id', '=', l)
      .executeTakeFirstOrThrow()
    expect(after).toEqual({ status: 'archived', previous_status: 'archived' })
    expect(
      (await call('PATCH', `/listings/${l}`, owner.cookie, { status: 'active' })).json().error.code,
    ).toBe('moderated')

    await call('POST', `/admin/content/listing/${l}/restore`, admin.cookie)
    const restored = await db
      .selectFrom('listings')
      .select(['status', 'previous_status'])
      .where('id', '=', l)
      .executeTakeFirstOrThrow()
    expect(restored).toEqual({ status: 'archived', previous_status: null })
    expect(
      (await call('POST', `/admin/content/listing/${l}/restore`, admin.cookie)).statusCode,
    ).toBe(400)
  })

  it('retirar y restaurar una petición; el panel ve todo el contenido en cualquier estado', async () => {
    const admin = await createTestUser(db, { admin: true })
    const owner = await createTestUser(db)
    const id = randomUUID()
    await db
      .insertInto('requests')
      .values({
        id,
        user_id: owner.id,
        title: 'Busco X',
        description: null,
        category_id: null,
        brand_id: null,
        scale: null,
        max_price_cents: null,
        photos: '[]',
        accepted_conditions: '["sealed"]',
        previous_status: null,
      })
      .execute()
    await call('POST', `/admin/content/request/${id}/take-down`, admin.cookie)
    expect((await call('GET', `/requests/${id}`)).statusCode).toBe(404)
    const all = await data(call('GET', '/admin/requests', admin.cookie))
    expect(all[0]).toMatchObject({ id, status: 'closed', previous_status: 'open' })
    await call('POST', `/admin/content/request/${id}/restore`, admin.cookie)
    expect((await call('GET', `/requests/${id}`)).statusCode).toBe(200)
  })

  // ── denuncias ─────────────────────────────────────────────────────────────
  it('denuncias: una pendiente por objetivo, nunca sobre lo propio, avisa a los admins', async () => {
    const admin = await createTestUser(db, { admin: true })
    const seller = await createTestUser(db)
    const reporter = await createTestUser(db)
    const l = await listing(seller.id)

    const r = await call('POST', '/reports', reporter.cookie, {
      listingId: l,
      reason: 'counterfeit',
      details: 'Es una copia',
    })
    expect(r.statusCode).toBe(200)
    expect(r.json().data.pending_key).toBeUndefined()
    const dup = await call('POST', '/reports', reporter.cookie, { listingId: l, reason: 'spam' })
    expect(dup.json().error.code).toBe('already_reported')
    expect(
      (await call('POST', '/reports', seller.cookie, { listingId: l, reason: 'spam' })).statusCode,
    ).toBe(400)
    expect(
      (
        await call('POST', '/reports', reporter.cookie, {
          reportedUserId: reporter.id,
          reason: 'spam',
        })
      ).statusCode,
    ).toBe(400)

    const notes = await db
      .selectFrom('notifications')
      .selectAll()
      .where('user_id', '=', admin.id)
      .execute()
    expect(notes).toMatchObject([
      { type: 'report', title: 'Nuevo reporte sobre un anuncio', link: '/admin/reportes' },
    ])

    const [item] = await data(call('GET', '/admin/reports?status=pending', admin.cookie))
    expect(item).toMatchObject({
      targetKind: 'listing',
      targetTitle: 'Hasegawa Zero 1:48',
      targetLink: `/producto/${l}`,
    })

    await call('PATCH', `/admin/reports/${item.report.id}`, admin.cookie, {
      status: 'dismissed',
      note: 'Es original',
    })
    expect(await data(call('GET', '/admin/reports?status=pending', admin.cookie))).toHaveLength(0)
    // Resuelta la anterior, se puede volver a denunciar.
    expect(
      (await call('POST', '/reports', reporter.cookie, { listingId: l, reason: 'spam' }))
        .statusCode,
    ).toBe(200)
  })

  // ── borrado de cuentas ────────────────────────────────────────────────────
  it('un admin elimina una cuenta: borra todo (también sus fotos) y le avisa por email', async () => {
    const admin = await createTestUser(db, { admin: true })
    const u = await createTestUser(db)
    await listing(u.id)
    const dir = join(uploadsDir, 'photos', u.id)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'x.webp'), 'x')

    expect((await call('DELETE', `/admin/users/${admin.id}`, admin.cookie)).statusCode).toBe(400)
    expect((await call('DELETE', `/admin/users/${u.id}`, admin.cookie)).statusCode).toBe(200)

    expect(await db.selectFrom('users').select('id').where('id', '=', u.id).execute()).toHaveLength(
      0,
    )
    expect(
      await db.selectFrom('listings').select('id').where('user_id', '=', u.id).execute(),
    ).toHaveLength(0)
    await expect(stat(dir)).rejects.toThrow()
    const [mail] = await emails('account_deleted_by_admin')
    expect(mail.to_email).toBe(u.email)
  })

  it('baja propia: borra la cuenta, cierra la sesión y envía la confirmación; el último admin no puede', async () => {
    const u = await createTestUser(db)
    const res = await call('DELETE', '/account', u.cookie)
    expect(res.statusCode).toBe(200)
    expect(res.cookies.find((c) => c.name === 'mm_session')?.value).toBe('')
    expect((await call('GET', '/auth/me', u.cookie)).json().data).toBeNull()
    expect((await emails('account_deleted'))[0].to_email).toBe(u.email)

    const onlyAdmin = await createTestUser(db, { admin: true })
    const blocked = await call('DELETE', '/account', onlyAdmin.cookie)
    expect(blocked.json().error.code).toBe('last_admin')
  })

  // ── contacto ──────────────────────────────────────────────────────────────
  const contact = {
    name: 'Ana',
    email: 'ana@ejemplo.com',
    subject: 'Duda',
    message: 'Hola <b>equipo</b>\n¿Qué tal?',
  }

  it('contacto sin reCAPTCHA configurado: llega a hola@ con Reply-To del remitente y el texto escapado', async () => {
    expect(
      (await call('POST', '/contact', undefined, { ...contact, email: 'no-es-email' })).statusCode,
    ).toBe(400)
    expect((await call('POST', '/contact', undefined, contact)).statusCode).toBe(200)
    const [mail] = await emails('contact')
    expect(mail).toMatchObject({
      to_email: 'hola@modelmarket.es',
      reply_to: 'ana@ejemplo.com',
      subject: 'Contacto: Duda',
    })
    expect(mail.html).toContain('Hola &lt;b&gt;equipo&lt;/b&gt;<br>¿Qué tal?')
  })

  it('contacto con reCAPTCHA: rechaza sin token o con puntuación baja; acepta un humano', async () => {
    const strict = await testApp(db, {
      UPLOADS_DIR: uploadsDir,
      RECAPTCHA_SECRET: 'secreto-de-prueba',
    })
    const post = (body: object) =>
      strict.inject({
        method: 'POST',
        url: '/api/contact',
        payload: body,
        headers: { origin: TEST_ORIGIN },
      })
    const google = (score: number) =>
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ success: true, score }))),
      )

    expect((await post(contact)).json().error.code).toBe('recaptcha_failed')
    google(0.2)
    expect((await post({ ...contact, recaptchaToken: 'tok' })).json().error.code).toBe(
      'recaptcha_failed',
    )
    google(0.9)
    expect((await post({ ...contact, recaptchaToken: 'tok' })).statusCode).toBe(200)
    await strict.close()
  })
})
