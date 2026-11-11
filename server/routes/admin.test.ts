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

  // ── operaciones en bloque ─────────────────────────────────────────────────
  it('edición en bloque: solo admins; aplica lo indicado y no mueve lo retirado por moderación', async () => {
    const admin = await createTestUser(db, { admin: true })
    const owner = await createTestUser(db)
    const a = await listing(owner.id)
    const b = await listing(owner.id, { price_cents: 1999 })
    const moderated = await listing(owner.id, { status: 'archived', previous_status: 'active' })
    const untouched = await listing(owner.id)
    const ids = [a, b, moderated]
    const category = await db.selectFrom('categories').select('id').executeTakeFirstOrThrow()

    const body = { ids, changes: { status: 'sold_showcase', accepts_offers: false } }
    expect((await call('POST', '/admin/listings/bulk-update', owner.cookie, body)).statusCode).toBe(
      403,
    )

    const res = await call('POST', '/admin/listings/bulk-update', admin.cookie, {
      ids,
      changes: {
        status: 'sold_showcase',
        category_id: category.id,
        decals: 'yellowed',
        shipping_inpost: true,
        price_percent: -10,
      },
    })
    expect(res.json().data).toEqual({ updated: 3, skippedModerated: 1 })
    const rows = await db
      .selectFrom('listings')
      .select([
        'id',
        'status',
        'sold_showcase',
        'previous_status',
        'category_id',
        'decals',
        'shipping_inpost',
        'price_cents',
        'condition',
      ])
      .where('user_id', '=', owner.id)
      .execute()
    const byId = new Map(rows.map((r) => [r.id, r]))
    expect(byId.get(a)).toMatchObject({
      status: 'sold',
      sold_showcase: true,
      category_id: category.id,
      decals: 'yellowed',
      shipping_inpost: true,
      price_cents: 1800,
    })
    expect(byId.get(b)!.price_cents).toBe(1799) // 1999 × 0,9 = 1799,1 → 1799
    // Lo moderado cambia sus datos, pero no de estado: sigue retirado.
    expect(byId.get(moderated)).toMatchObject({
      status: 'archived',
      previous_status: 'active',
      decals: 'yellowed',
    })
    expect(byId.get(untouched)).toMatchObject({
      status: 'active',
      decals: 'perfect',
      price_cents: 2000,
    })

    // Vendido «fuera del catálogo» quita la marca de escaparate.
    await call('POST', '/admin/listings/bulk-update', admin.cookie, {
      ids: [a],
      changes: { status: 'sold' },
    })
    expect(
      (
        await db
          .selectFrom('listings')
          .select('sold_showcase')
          .where('id', '=', a)
          .executeTakeFirstOrThrow()
      ).sold_showcase,
    ).toBeFalsy()

    const empty = await call('POST', '/admin/listings/bulk-update', admin.cookie, {
      ids,
      changes: {},
    })
    expect(empty.statusCode).toBe(400)
    const zero = await call('POST', '/admin/listings/bulk-update', admin.cookie, {
      ids,
      changes: { price_percent: 0 },
    })
    expect(zero.statusCode).toBe(400)
  })

  it('borrado en bloque: solo admins; borra los anuncios y sus fotos del disco', async () => {
    const admin = await createTestUser(db, { admin: true })
    const owner = await createTestUser(db)
    const dir = join(uploadsDir, 'photos', owner.id)
    await mkdir(dir, { recursive: true })
    const file = randomUUID()
    await writeFile(join(dir, `${file}.webp`), 'x')
    await writeFile(join(dir, `${file}-sm.webp`), 'x')
    const photo = `/uploads/photos/${owner.id}/${file}.webp`
    const a = await listing(owner.id, { photos: JSON.stringify([photo]) })
    const b = await listing(owner.id)
    const keep = await listing(owner.id)

    expect(
      (await call('POST', '/admin/listings/bulk-delete', owner.cookie, { ids: [a, b] })).statusCode,
    ).toBe(403)
    expect(
      await data(call('POST', '/admin/listings/bulk-delete', admin.cookie, { ids: [a, b] })),
    ).toEqual({ deleted: 2 })
    const left = await db
      .selectFrom('listings')
      .select('id')
      .where('user_id', '=', owner.id)
      .execute()
    expect(left.map((r) => r.id)).toEqual([keep])
    await expect(stat(join(dir, `${file}.webp`))).rejects.toThrow()
    await expect(stat(join(dir, `${file}-sm.webp`))).rejects.toThrow()
    expect(
      (await call('POST', '/admin/listings/bulk-delete', admin.cookie, { ids: [] })).statusCode,
    ).toBe(400)
  })

  it('en bloque y al dar de baja una cuenta se avisa a quien tenía los anuncios en favoritos (un aviso por persona)', async () => {
    const admin = await createTestUser(db, { admin: true })
    const owner = await createTestUser(db)
    const fan = await createTestUser(db)
    const other = await createTestUser(db)
    const ids = [
      await listing(owner.id, { title: 'Airfix Spitfire' }),
      await listing(owner.id, { title: 'Revell Bismarck' }),
      await listing(owner.id, { title: 'Tamiya Tiger I' }),
    ]
    for (const id of ids) {
      await db
        .insertInto('favorites')
        .values({ id: randomUUID(), user_id: fan.id, listing_id: id })
        .execute()
    }
    await db
      .insertInto('favorites')
      .values({ id: randomUUID(), user_id: other.id, listing_id: ids[2] })
      .execute()
    const noticesOf = (userId: string) =>
      db
        .selectFrom('notifications')
        .select(['title', 'body'])
        .where('user_id', '=', userId)
        .where('type', '=', 'favorite_withdrawn')
        .orderBy('created_at')
        .execute()

    // Suspender en bloque: un único aviso agrupado para quien guardó varias.
    await call('POST', '/admin/listings/bulk-update', admin.cookie, {
      ids: ids.slice(0, 2),
      changes: { status: 'archived' },
    })
    const [grouped] = await noticesOf(fan.id)
    expect(grouped).toEqual({
      title: '2 maquetas de tus favoritos ya no están disponibles',
      body: 'Se han retirado del catálogo: «Airfix Spitfire», «Revell Bismarck». Si vuelven a publicarse, te aparecerán otra vez en Favoritos.',
    })

    // Borrar en bloque (aunque estén suspendidas): otro aviso agrupado.
    await call('POST', '/admin/listings/bulk-delete', admin.cookie, { ids: ids.slice(0, 2) })
    expect((await noticesOf(fan.id))[1].body).toBe(
      'Se han eliminado y ya no están en el catálogo: «Airfix Spitfire», «Revell Bismarck».',
    )

    // Baja de la cuenta: avisa por lo que le quedaba publicado.
    expect((await call('DELETE', `/admin/users/${owner.id}`, admin.cookie)).statusCode).toBe(200)
    expect((await noticesOf(fan.id))[2].body).toBe(
      '«Tamiya Tiger I» se ha eliminado y ya no está en el catálogo.',
    )
    expect(await noticesOf(other.id)).toHaveLength(1)
    expect(await noticesOf(owner.id)).toHaveLength(0)
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
