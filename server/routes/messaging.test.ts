import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { TEST_DB_URL, TEST_ORIGIN, createTestUser, resetTestDb, testApp } from '../test/helpers'

describe.skipIf(!TEST_DB_URL)('API de mensajería, ofertas y notificaciones', () => {
  let db: Db
  let app: FastifyInstance

  beforeAll(async () => {
    db = await resetTestDb()
    app = await testApp(db)
  })
  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })
  beforeEach(async () => {
    await db.deleteFrom('email_outbox').execute()
    await db.deleteFrom('users').execute()
  })

  type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  const call = (method: Method, url: string, cookie?: string, payload?: object) =>
    app.inject({
      method,
      url: `/api${url}`,
      payload,
      headers: { origin: TEST_ORIGIN, ...(cookie ? { cookie } : {}) },
    })
  const data = async (p: ReturnType<typeof call>) => (await p).json().data

  /** Anuncio ya público, insertado directamente (sin pasar por la subida de fotos). */
  async function listing(userId: string, extra: Record<string, unknown> = {}) {
    const id = randomUUID()
    await db
      .insertInto('listings')
      .values({
        id,
        user_id: userId,
        title: 'Tamiya Spitfire 1:48',
        description: null,
        price_cents: 3000,
        condition: 'sealed',
        decals: 'perfect',
        scale: '1:48',
        category_id: null,
        brand_id: null,
        photos: '["/uploads/x.webp"]',
        previous_status: null,
        visible_at: new Date(Date.now() - 1000),
        ...extra,
      })
      .execute()
    return id
  }

  async function request(userId: string, extra: Record<string, unknown> = {}) {
    const id = randomUUID()
    await db
      .insertInto('requests')
      .values({
        id,
        user_id: userId,
        title: 'Busco Bismarck 1:350',
        description: null,
        category_id: null,
        brand_id: null,
        scale: '1:350',
        max_price_cents: 9000,
        photos: '[]',
        accepted_conditions: '["sealed"]',
        previous_status: null,
        ...extra,
      })
      .execute()
    return id
  }

  const notificationsOf = (userId: string) =>
    db
      .selectFrom('notifications')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at')
      .execute()
  const emailsTo = (email: string) =>
    db
      .selectFrom('email_outbox')
      .selectAll()
      .where('to_email', '=', email)
      .orderBy('created_at')
      .execute()

  // ── conversaciones y mensajes ─────────────────────────────────────────────
  it('"Contactar" abre una conversación y la reutiliza; no con uno mismo ni con lo que no se ve', async () => {
    const seller = await createTestUser(db)
    const buyer = await createTestUser(db)
    const l = await listing(seller.id)
    const a = await data(call('POST', '/conversations', buyer.cookie, { listingId: l }))
    const b = await data(call('POST', '/conversations', buyer.cookie, { listingId: l }))
    expect(a.id).toBe(b.id)
    expect((await call('POST', '/conversations', seller.cookie, { listingId: l })).statusCode).toBe(
      400,
    )

    const hidden = await listing(seller.id, { visible_at: new Date(Date.now() + 3_600_000) })
    expect(
      (await call('POST', '/conversations', buyer.cookie, { listingId: hidden })).statusCode,
    ).toBe(404)
  })

  it('mensajes: solo los participantes; aviso + email al primero, y los siguientes se agrupan', async () => {
    const seller = await createTestUser(db)
    const buyer = await createTestUser(db)
    const stranger = await createTestUser(db)
    const l = await listing(seller.id)
    const { id: conv } = await data(call('POST', '/conversations', buyer.cookie, { listingId: l }))

    await call('POST', `/conversations/${conv}/messages`, buyer.cookie, {
      body: '¿Sigue disponible?',
    })
    await call('POST', `/conversations/${conv}/messages`, buyer.cookie, {
      body: '¿Envías a Madrid?',
    })

    const notes = await notificationsOf(seller.id)
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({
      type: 'message',
      body: '¿Envías a Madrid?',
      link: `/mensajes/${conv}`,
    })
    expect(await emailsTo(seller.email)).toHaveLength(1)

    expect((await call('GET', `/conversations/${conv}/messages`, stranger.cookie)).statusCode).toBe(
      404,
    )
    expect(
      (await call('POST', `/conversations/${conv}/messages`, stranger.cookie, { body: 'hola' }))
        .statusCode,
    ).toBe(404)
    const msgs = await data(call('GET', `/conversations/${conv}/messages`, seller.cookie))
    expect(msgs.map((m: { body: string }) => m.body)).toEqual([
      '¿Sigue disponible?',
      '¿Envías a Madrid?',
    ])
  })

  it('no leídos: cuenta los recibidos y se ponen a cero al abrir la conversación', async () => {
    const seller = await createTestUser(db)
    const buyer = await createTestUser(db)
    const { id: conv } = await data(
      call('POST', '/conversations', buyer.cookie, { listingId: await listing(seller.id) }),
    )
    await call('POST', `/conversations/${conv}/messages`, buyer.cookie, { body: 'Uno' })
    await call('POST', `/conversations/${conv}/messages`, buyer.cookie, { body: 'Dos' })

    expect(await data(call('GET', '/messages/unread-count', seller.cookie))).toEqual({ count: 2 })
    expect(await data(call('GET', '/messages/unread-count', buyer.cookie))).toEqual({ count: 0 })
    await call('POST', `/conversations/${conv}/read`, seller.cookie)
    expect(await data(call('GET', '/messages/unread-count', seller.cookie))).toEqual({ count: 0 })
  })

  it('bandeja: con el nombre de la otra parte y el asunto; "no disponible" si se retira', async () => {
    const seller = await createTestUser(db)
    const buyer = await createTestUser(db)
    const l = await listing(seller.id)
    const { id: conv } = await data(call('POST', '/conversations', buyer.cookie, { listingId: l }))
    await call('POST', `/conversations/${conv}/messages`, buyer.cookie, { body: 'Hola' })

    const [item] = await data(call('GET', '/conversations', seller.cookie))
    expect(item).toMatchObject({
      otherUserId: buyer.id,
      otherName: buyer.email.split('@')[0],
      subjectKind: 'listing',
      subjectTitle: 'Tamiya Spitfire 1:48',
      subjectAvailable: true,
      subjectLink: `/producto/${l}`,
    })

    await db
      .updateTable('listings')
      .set({ status: 'archived', previous_status: 'active' })
      .where('id', '=', l)
      .execute()
    const [after] = await data(call('GET', '/conversations', buyer.cookie))
    expect(after).toMatchObject({
      subjectTitle: 'Anuncio no disponible',
      subjectAvailable: false,
      subjectLink: null,
    })
  })

  it('ocultar una conversación es solo por mi lado, y reaparece si la otra parte escribe', async () => {
    const seller = await createTestUser(db)
    const buyer = await createTestUser(db)
    const { id: conv } = await data(
      call('POST', '/conversations', buyer.cookie, { listingId: await listing(seller.id) }),
    )
    await call('POST', `/conversations/${conv}/messages`, buyer.cookie, { body: 'Hola' })

    await call('DELETE', `/conversations/${conv}`, seller.cookie)
    expect(await data(call('GET', '/conversations', seller.cookie))).toHaveLength(0)
    expect(await data(call('GET', '/conversations', buyer.cookie))).toHaveLength(1)

    await call('POST', `/conversations/${conv}/messages`, buyer.cookie, { body: '¿Sigues ahí?' })
    expect(await data(call('GET', '/conversations', seller.cookie))).toHaveLength(1)
  })

  it('el email del aviso escapa lo que escribió la otra persona y respeta "no quiero emails"', async () => {
    const seller = await createTestUser(db)
    const buyer = await createTestUser(db)
    const { id: conv } = await data(
      call('POST', '/conversations', buyer.cookie, { listingId: await listing(seller.id) }),
    )
    await call('POST', `/conversations/${conv}/messages`, buyer.cookie, {
      body: '<img src=x onerror=alert(1)>',
    })
    const [mail] = await emailsTo(seller.email)
    expect(mail.html).not.toContain('<img src=x')
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(mail.headers).toMatchObject({
      'List-Unsubscribe': '<http://localhost:5173/configuracion>',
    })

    await db
      .updateTable('profiles')
      .set({ notify_email: false })
      .where('id', '=', buyer.id)
      .execute()
    await call('POST', `/conversations/${conv}/read`, buyer.cookie)
    await call('POST', `/conversations/${conv}/messages`, seller.cookie, { body: 'Sí, disponible' })
    expect(await notificationsOf(buyer.id)).toHaveLength(1) // el aviso sí
    expect(await emailsTo(buyer.email)).toHaveLength(0) // el email no
  })

  // ── ofertas sobre anuncios ────────────────────────────────────────────────
  it('oferta: abre conversación con mensaje de oferta y avisa; re-ofertar solo avisa si cambia el importe', async () => {
    const seller = await createTestUser(db)
    const buyer = await createTestUser(db)
    const l = await listing(seller.id)

    const { conversationId } = await data(
      call('POST', '/offers', buyer.cookie, {
        listingId: l,
        amountCents: 2500,
        message: 'Te pago hoy',
      }),
    )
    const msgs = await data(call('GET', `/conversations/${conversationId}/messages`, buyer.cookie))
    expect(msgs[0]).toMatchObject({ kind: 'offer', body: 'Oferta: 25.00 €\nTe pago hoy' })
    expect((await notificationsOf(seller.id)).map((n) => n.title)).toEqual([
      'Nueva oferta: 25.00 €',
    ])

    await call('POST', '/offers', buyer.cookie, { listingId: l, amountCents: 2500 })
    await call('POST', '/offers', buyer.cookie, { listingId: l, amountCents: 2700 })
    expect((await notificationsOf(seller.id)).map((n) => n.title)).toEqual([
      'Nueva oferta: 25.00 €',
      'Oferta actualizada: 27.00 €',
    ])
    const pending = await db.selectFrom('offers').selectAll().where('listing_id', '=', l).execute()
    expect(pending).toHaveLength(1)
    expect(pending[0].amount_cents).toBe(2700)
  })

  it('oferta: no sobre lo propio, ni por debajo del precio si el vendedor no regatea', async () => {
    const seller = await createTestUser(db)
    const buyer = await createTestUser(db)
    const firm = await listing(seller.id, { accepts_offers: false })
    expect(
      (await call('POST', '/offers', seller.cookie, { listingId: firm, amountCents: 3000 }))
        .statusCode,
    ).toBe(400)
    const low = await call('POST', '/offers', buyer.cookie, { listingId: firm, amountCents: 2000 })
    expect(low.json().error.code).toBe('no_haggling')
    expect(
      (await call('POST', '/offers', buyer.cookie, { listingId: firm, amountCents: 3000 }))
        .statusCode,
    ).toBe(200)
  })

  it('aceptar: solo quien la recibe; reserva el anuncio, avisa y no se puede resolver dos veces', async () => {
    const seller = await createTestUser(db)
    const buyer = await createTestUser(db)
    const l = await listing(seller.id)
    await call('POST', '/offers', buyer.cookie, { listingId: l, amountCents: 2800 })
    const [{ offer }] = await data(call('GET', '/offers?box=received', seller.cookie))

    expect(
      (await call('PATCH', `/offers/${offer.id}`, buyer.cookie, { status: 'accepted' })).statusCode,
    ).toBe(403)
    expect(
      (await call('PATCH', `/offers/${offer.id}`, seller.cookie, { status: 'accepted' }))
        .statusCode,
    ).toBe(200)

    const l2 = await db
      .selectFrom('listings')
      .select('status')
      .where('id', '=', l)
      .executeTakeFirstOrThrow()
    expect(l2.status).toBe('reserved')
    expect((await notificationsOf(buyer.id)).map((n) => n.title)).toContain(
      'Han aceptado tu oferta',
    )
    const again = await call('PATCH', `/offers/${offer.id}`, seller.cookie, { status: 'rejected' })
    expect(again.json().error.code).toBe('offer_resolved')
  })

  it('retirar: solo quien la envió; después puede volver a ofertar', async () => {
    const seller = await createTestUser(db)
    const buyer = await createTestUser(db)
    const l = await listing(seller.id)
    await call('POST', '/offers', buyer.cookie, { listingId: l, amountCents: 2000 })
    const [{ offer }] = await data(call('GET', '/offers?box=sent', buyer.cookie))
    expect(
      (await call('PATCH', `/offers/${offer.id}`, seller.cookie, { status: 'withdrawn' }))
        .statusCode,
    ).toBe(403)
    expect(
      (await call('PATCH', `/offers/${offer.id}`, buyer.cookie, { status: 'withdrawn' }))
        .statusCode,
    ).toBe(200)
    expect(
      (await call('POST', '/offers', buyer.cookie, { listingId: l, amountCents: 2200 })).statusCode,
    ).toBe(200)
    expect(
      await db.selectFrom('offers').selectAll().where('listing_id', '=', l).execute(),
    ).toHaveLength(2)
  })

  // ── ofertas sobre peticiones ──────────────────────────────────────────────
  it('responder a una petición es de PRO; la conversación queda autor ↔ quien ofrece', async () => {
    const author = await createTestUser(db)
    const free = await createTestUser(db)
    const pro = await createTestUser(db, { tier: 'pro' })
    const r = await request(author.id)

    const denied = await call('POST', '/offers', free.cookie, { requestId: r, amountCents: 8000 })
    expect(denied.statusCode).toBe(403)
    expect(denied.json().error.code).toBe('plan_required')

    const { conversationId } = await data(
      call('POST', '/offers', pro.cookie, { requestId: r, amountCents: 8000 }),
    )
    const conv = await db
      .selectFrom('conversations')
      .selectAll()
      .where('id', '=', conversationId)
      .executeTakeFirstOrThrow()
    expect(conv).toMatchObject({ request_id: r, buyer_id: author.id, seller_id: pro.id })
    expect(await data(call('GET', `/requests/${r}/offer-count`))).toEqual({ count: 1 })

    // Cumplida: deja de ser pública, así que para un tercero ya no existe.
    await db.updateTable('requests').set({ status: 'fulfilled' }).where('id', '=', r).execute()
    const pro2 = await createTestUser(db, { tier: 'pro' })
    expect(
      (await call('POST', '/offers', pro2.cookie, { requestId: r, amountCents: 1 })).statusCode,
    ).toBe(404)
  })

  it('ofertas de un anuncio: el dueño ve todas; cada comprador, solo la suya', async () => {
    const seller = await createTestUser(db)
    const a = await createTestUser(db)
    const b = await createTestUser(db)
    const l = await listing(seller.id)
    await call('POST', '/offers', a.cookie, { listingId: l, amountCents: 2000 })
    await call('POST', '/offers', b.cookie, { listingId: l, amountCents: 2100 })

    expect(await data(call('GET', `/listings/${l}/offers`, seller.cookie))).toHaveLength(2)
    const mine = await data(call('GET', `/listings/${l}/offers`, a.cookie))
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({
      senderName: a.email.split('@')[0],
      offer: { amount_cents: 2000 },
    })
    expect(mine[0].offer.pending_key).toBeUndefined()
  })

  // ── notificaciones ────────────────────────────────────────────────────────
  it('retirar un anuncio guardado avisa a quien lo guardó (email según preferencia), una vez por semana', async () => {
    const seller = await createTestUser(db)
    const fan = await createTestUser(db)
    const quiet = await createTestUser(db)
    const other = await createTestUser(db)
    await db
      .updateTable('profiles')
      .set({ notify_email: false })
      .where('id', '=', quiet.id)
      .execute()
    const l = await listing(seller.id)
    await call('PUT', `/favorites/${l}`, fan.cookie)
    await call('PUT', `/favorites/${l}`, quiet.cookie)
    await call('PUT', `/favorites/${l}`, seller.cookie) // lo propio no cuenta
    await db.deleteFrom('email_outbox').execute()

    expect(
      (await call('PATCH', `/listings/${l}`, seller.cookie, { status: 'archived' })).statusCode,
    ).toBe(200)
    const [n] = await notificationsOf(fan.id)
    expect(n).toMatchObject({
      type: 'favorite_withdrawn',
      title: 'Una maqueta de tus favoritos ya no está disponible',
      link: '/explorar',
    })
    expect(n.body).toContain('Tamiya Spitfire 1:48')
    const mails = await emailsTo(fan.email)
    expect(mails).toHaveLength(1)
    expect(mails[0].subject).toBe('Una maqueta de tus favoritos ya no está disponible')
    // Sin emails activados: solo la campanita.
    expect(await notificationsOf(quiet.id)).toHaveLength(1)
    expect(await emailsTo(quiet.email)).toHaveLength(0)
    expect(
      (await notificationsOf(seller.id)).filter((x) => x.type === 'favorite_withdrawn'),
    ).toHaveLength(0)
    expect(await notificationsOf(other.id)).toHaveLength(0)

    // Reactivar y volver a suspender en la misma semana no repite el aviso.
    await call('PATCH', `/listings/${l}`, seller.cookie, { status: 'active' })
    await call('PATCH', `/listings/${l}`, seller.cookie, { status: 'archived' })
    expect(await emailsTo(fan.email)).toHaveLength(1)
    expect(await notificationsOf(fan.id)).toHaveLength(1)
  })

  it('eliminar un anuncio guardado avisa; venderlo, la retirada de un admin o lo ya retirado, no', async () => {
    const seller = await createTestUser(db)
    const admin = await createTestUser(db, { admin: true })
    const fan = await createTestUser(db)
    const sold = await listing(seller.id)
    const takenDown = await listing(seller.id)
    const archived = await listing(seller.id, { status: 'archived' })
    const deleted = await listing(seller.id, { title: 'Hasegawa Zero 1:48' })
    for (const l of [sold, takenDown, deleted]) await call('PUT', `/favorites/${l}`, fan.cookie)
    await db
      .insertInto('favorites')
      .values({ id: randomUUID(), user_id: fan.id, listing_id: archived })
      .execute()

    await call('PATCH', `/listings/${sold}`, seller.cookie, { status: 'sold' })
    await call('PATCH', `/listings/${takenDown}`, admin.cookie, { status: 'archived' })
    await call('DELETE', `/listings/${archived}`, seller.cookie)
    expect(await notificationsOf(fan.id)).toHaveLength(0)

    expect((await call('DELETE', `/listings/${deleted}`, seller.cookie)).statusCode).toBe(200)
    const list = await notificationsOf(fan.id)
    expect(list).toHaveLength(1)
    expect(list[0].body).toBe(
      '«Hasegawa Zero 1:48» ya no está en el catálogo: su vendedor lo ha eliminado.',
    )
    expect(await emailsTo(fan.email)).toHaveLength(1)
  })

  it('favorito: avisa al dueño (no al guardar lo propio); campanita, contador y marcar leídas', async () => {
    const seller = await createTestUser(db)
    const fan = await createTestUser(db)
    const l = await listing(seller.id)
    await call('PUT', `/favorites/${l}`, seller.cookie)
    expect(await notificationsOf(seller.id)).toHaveLength(0)

    await call('PUT', `/favorites/${l}`, fan.cookie)
    await call('PUT', `/favorites/${l}`, fan.cookie) // repetir no vuelve a avisar
    const list = await data(call('GET', '/notifications', seller.cookie))
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      type: 'favorite',
      title: 'Han guardado tu anuncio',
      link: `/producto/${l}`,
    })
    expect(await data(call('GET', '/notifications/unread-count', seller.cookie))).toEqual({
      count: 1,
    })

    await call('POST', '/notifications/read-all', seller.cookie)
    expect(await data(call('GET', '/notifications/unread-count', seller.cookie))).toEqual({
      count: 0,
    })
    expect(await data(call('GET', '/notifications', fan.cookie))).toHaveLength(0)
  })

  it('todo exige sesión (401 antes que validar datos) salvo el contador público de ofertas', async () => {
    const id = randomUUID()
    for (const [m, u] of [
      ['GET', '/conversations'],
      ['POST', '/conversations'],
      ['GET', `/conversations/${id}/messages`],
      ['POST', `/conversations/${id}/messages`],
      ['GET', '/messages/unread-count'],
      ['GET', '/offers'],
      ['POST', '/offers'],
      ['PATCH', `/offers/${id}`],
      ['GET', '/notifications'],
      ['POST', '/notifications/read-all'],
    ] as const) {
      const res = await call(m, u, undefined, m === 'GET' ? undefined : {})
      expect(res.statusCode, `${m} ${u}`).toBe(401)
    }
    expect((await call('GET', `/requests/${id}/offer-count`)).statusCode).toBe(200)
  })
})
