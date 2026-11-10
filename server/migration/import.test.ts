import { randomUUID } from 'node:crypto'
import { rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { jsonArray } from '../db/json'
import { TEST_DB_URL, TEST_ORIGIN, resetTestDb, tempUploadsDir, testApp } from '../test/helpers'
import { importData } from './import'
import type { SourceData } from './source'

const STORAGE = 'https://proyecto.supabase.co/storage/v1/object/public'
const AVIACION = '79ed83f5-129e-48a5-8394-bbfd5ca2d636'

/** Datos con la forma que devuelve `readSupabase` (filas de Postgres). */
async function fixture() {
  const seller = randomUUID()
  const buyer = randomUUID()
  const listing = randomUUID()
  const request = randomUUID()
  const conv = randomUUID()
  const created = new Date('2026-07-20T10:15:30.123Z')
  const data: SourceData = {
    users: [
      {
        id: seller,
        email: 'Vendedor@Ejemplo.com',
        encrypted_password: await bcrypt.hash('clave-de-v2', 10),
        email_confirmed_at: created,
        last_sign_in_at: created,
        created_at: created,
      },
      {
        id: buyer,
        email: 'comprador@ejemplo.com',
        encrypted_password: await bcrypt.hash('otra-clave', 10),
        email_confirmed_at: created,
        last_sign_in_at: null,
        created_at: created,
      },
    ],
    profiles: [
      {
        id: seller,
        username: 'vende',
        display_name: 'Vendedor',
        avatar_url: `${STORAGE}/avatars/${seller}/a.jpg`,
        bio: null,
        location: 'Madrid',
        notify_email: true,
        notify_push: false,
        created_at: created,
      },
      {
        id: buyer,
        username: null,
        display_name: 'Comprador',
        avatar_url: null,
        bio: null,
        location: null,
        notify_email: false,
        notify_push: false,
        created_at: created,
      },
    ],
    user_roles: [
      { id: randomUUID(), user_id: seller, role: 'admin', created_at: created },
      { id: randomUUID(), user_id: seller, role: 'user', created_at: created },
      { id: randomUUID(), user_id: buyer, role: 'user', created_at: created },
    ],
    user_suspensions: [],
    categories: [{ id: AVIACION, name: 'Aviación', slug: 'aviacion', parent_id: null }],
    brands: [{ id: randomUUID(), name: 'Eduard', slug: 'eduard' }],
    listings: [
      {
        id: listing,
        ref_number: '7',
        user_id: seller,
        title: 'Eduard Bf 109 1:48',
        description: 'Completo',
        price_cents: 3500,
        currency: 'EUR',
        condition: 'opened',
        decals: 'yellowed',
        scale: '1:48',
        category_id: AVIACION,
        brand_id: null,
        photos_json: [
          `${STORAGE}/listing-photos/${seller}/p.png`,
          `${STORAGE}/listing-photos/${seller}/rota.png`,
        ],
        status: 'active',
        previous_status: null,
        shipping_inpost: true,
        hand_delivery: false,
        accepts_offers: true,
        views: 12,
        visible_at: created,
        created_at: created,
        updated_at: created,
      },
    ],
    requests: [
      {
        id: request,
        user_id: buyer,
        title: 'Busco Tiger 1:35',
        description: null,
        category_id: null,
        brand_id: null,
        scale: '1:35',
        max_price_cents: 4000,
        photos_json: [],
        conditions_json: ['sealed', 'opened'],
        decals_requirement: 'any',
        urgency: 'urgent',
        status: 'open',
        previous_status: null,
        created_at: created,
        updated_at: created,
      },
    ],
    favorites: [{ id: randomUUID(), user_id: buyer, listing_id: listing, created_at: created }],
    conversations: [
      {
        id: conv,
        listing_id: listing,
        request_id: null,
        buyer_id: buyer,
        seller_id: seller,
        buyer_deleted_at: null,
        seller_deleted_at: null,
        created_at: created,
        updated_at: created,
      },
    ],
    messages: [
      {
        id: randomUUID(),
        conversation_id: conv,
        sender_id: buyer,
        body: '¿Sigue disponible?',
        kind: 'text',
        read_at: null,
        created_at: created,
      },
    ],
    offers: [
      {
        id: randomUUID(),
        listing_id: listing,
        request_id: null,
        from_user_id: buyer,
        to_user_id: seller,
        conversation_id: conv,
        amount_cents: 3000,
        message: null,
        status: 'pending',
        created_at: created,
        updated_at: created,
      },
    ],
    notifications: [
      {
        id: randomUUID(),
        user_id: seller,
        type: 'offer',
        title: 'Nueva oferta: 30.00 €',
        body: null,
        link: `/mensajes/${conv}`,
        read_at: null,
        created_at: created,
      },
    ],
    reports: [],
    subscriptions: [
      {
        id: randomUUID(),
        user_id: seller,
        tier: 'pro',
        status: 'active',
        stripe_customer_id: 'cus_x',
        stripe_subscription_id: 'sub_x',
        current_period_end: created,
        created_at: created,
        updated_at: created,
      },
    ],
  }
  return { data, seller, buyer, listing, request, created }
}

/** "Descarga" falsa: imagen generada; la que contiene "rota" falla como un 404. */
const fakeFetch = async (url: string) => {
  if (url.includes('rota')) throw new Error('HTTP 404')
  return sharp({ create: { width: 800, height: 600, channels: 3, background: '#556' } })
    .png()
    .toBuffer()
}

describe.skipIf(!TEST_DB_URL)('importación desde Supabase', () => {
  let db: Db
  let uploadsDir: string

  beforeAll(async () => {
    db = await resetTestDb()
    uploadsDir = await tempUploadsDir()
  })
  afterAll(async () => {
    await db?.destroy()
    if (uploadsDir) await rm(uploadsDir, { recursive: true, force: true })
  })

  it('importa todo conservando IDs, referencias y fechas; las contraseñas de v2 siguen valiendo', async () => {
    const f = await fixture()
    const report = await importData(db, f.data, { uploadsDir, fetchImage: fakeFetch })

    expect(report.counts).toMatchObject({
      users: 2,
      profiles: 2,
      listings: 1,
      requests: 1,
      messages: 1,
      offers: 1,
      subscriptions: 1,
    })
    expect(report.photosMigrated).toBe(2) // foto del anuncio + avatar
    expect(report.photosFailed).toHaveLength(1)

    // Email normalizado, fecha idéntica al milisegundo (UTC).
    const u = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', f.seller)
      .executeTakeFirstOrThrow()
    expect(u.email).toBe('vendedor@ejemplo.com')
    expect(u.created_at.toISOString()).toBe(f.created.toISOString())

    // Anuncio: misma referencia; la foto rota se descarta y la buena pasa a WebP local.
    const l = await db
      .selectFrom('listings')
      .selectAll()
      .where('id', '=', f.listing)
      .executeTakeFirstOrThrow()
    expect(Number(l.ref_number)).toBe(7)
    const photos = jsonArray<string>(l.photos)
    expect(photos).toHaveLength(1)
    expect(photos[0]).toMatch(new RegExp(`^/uploads/photos/${f.seller}/[0-9a-f-]{36}\\.webp$`))
    await stat(join(uploadsDir, photos[0].replace('/uploads/', '')))
    const avatar = (
      await db
        .selectFrom('profiles')
        .select('avatar_url')
        .where('id', '=', f.seller)
        .executeTakeFirstOrThrow()
    ).avatar_url
    expect(avatar).toMatch(/^\/uploads\/avatars\//)

    const r = await db
      .selectFrom('requests')
      .selectAll()
      .where('id', '=', f.request)
      .executeTakeFirstOrThrow()
    expect(jsonArray(r.accepted_conditions)).toEqual(['sealed', 'opened'])

    // Login con la contraseña de v2 → se recifra con argon2id; el rol admin se conserva.
    const app = await testApp(db, { UPLOADS_DIR: uploadsDir })
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'vendedor@ejemplo.com', password: 'clave-de-v2' },
      headers: { origin: TEST_ORIGIN },
    })
    expect(login.statusCode, login.body).toBe(200)
    expect(login.json().data).toMatchObject({ isAdmin: true, emailVerified: true })
    const after = await db
      .selectFrom('users')
      .select('password_hash')
      .where('id', '=', f.seller)
      .executeTakeFirstOrThrow()
    expect(after.password_hash).toMatch(/^\$argon2id\$/)
    await app.close()
  })

  it('los anuncios nuevos siguen numerándose después del último importado', async () => {
    await db
      .insertInto('listings')
      .values({
        id: randomUUID(),
        user_id: (await db.selectFrom('users').select('id').executeTakeFirstOrThrow()).id,
        title: 'Nuevo',
        description: null,
        price_cents: 1,
        condition: 'sealed',
        decals: 'perfect',
        scale: null,
        category_id: null,
        brand_id: null,
        photos: '[]',
        previous_status: null,
      })
      .execute()
    const max = await db
      .selectFrom('listings')
      .select((eb) => eb.fn.max('ref_number').as('m'))
      .executeTakeFirstOrThrow()
    expect(Number(max.m)).toBe(8)
  })

  it('se niega a importar sobre datos existentes salvo con --wipe', async () => {
    const f = await fixture()
    await expect(importData(db, f.data, { uploadsDir, fetchImage: fakeFetch })).rejects.toThrow(
      /--wipe/,
    )
    const report = await importData(db, f.data, { uploadsDir, fetchImage: fakeFetch, wipe: true })
    expect(report.counts.users).toBe(2)
    expect(await db.selectFrom('users').select('id').execute()).toHaveLength(2)
  })
})
