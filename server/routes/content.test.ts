import { randomUUID } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { sql } from 'kysely'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import {
  TEST_DB_URL,
  TEST_ORIGIN,
  createTestUser,
  resetTestDb,
  tempUploadsDir,
  testApp,
} from '../test/helpers'

const AVIACION = '79ed83f5-129e-48a5-8394-bbfd5ca2d636'
const TAMIYA = '55c10d60-8da8-4603-aee9-67b090eb74ff'

/** JPEG real de 1200×900 con EXIF (incluida una "ubicación"), para probar la subida. */
async function sampleJpeg() {
  return sharp({ create: { width: 1200, height: 900, channels: 3, background: '#3a6ea5' } })
    .jpeg()
    .withExif({ IFD0: { Copyright: 'privado', ImageDescription: 'GPS 40.4168,-3.7038' } })
    .toBuffer()
}

/** Cuerpo multipart con un único fichero en el campo `file`. */
function multipart(buffer: Buffer, filename = 'foto.jpg', type = 'image/jpeg') {
  const boundary = `----mm${randomUUID()}`
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`,
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  return {
    payload: Buffer.concat([head, buffer, tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  }
}

describe.skipIf(!TEST_DB_URL)('API de contenido', () => {
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
    await db.deleteFrom('users').execute()
  })

  // ── utilidades ─────────────────────────────────────────────────────────────
  type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  const call = (method: Method, url: string, cookie?: string, payload?: object) =>
    app.inject({
      method,
      url: `/api${url}`,
      payload,
      headers: { origin: TEST_ORIGIN, ...(cookie ? { cookie } : {}) },
    })

  async function uploadPhoto(cookie: string) {
    const body = multipart(await sampleJpeg())
    const res = await app.inject({
      method: 'POST',
      url: '/api/uploads/photo',
      payload: body.payload,
      headers: { ...body.headers, origin: TEST_ORIGIN, cookie },
    })
    expect(res.statusCode, res.body).toBe(200)
    return res.json().data.url as string
  }

  async function newListing(cookie: string, extra: object = {}) {
    const res = await call('POST', '/listings', cookie, {
      title: 'Spitfire Mk.I 1:48',
      description: 'Caja precintada, completa.',
      price_cents: 2500,
      condition: 'sealed',
      decals: 'perfect',
      scale: '1:48',
      category_id: AVIACION,
      brand_id: TAMIYA,
      photos: [await uploadPhoto(cookie)],
      ...extra,
    })
    return res
  }

  /** Publica el anuncio ya (sin esperar el retardo del plan Free). */
  const makeVisibleNow = (id: string) =>
    db
      .updateTable('listings')
      .set({ visible_at: sql<Date>`NOW(3) - INTERVAL 1 SECOND` })
      .where('id', '=', id)
      .execute()

  const publicIds = async (url = '/listings') =>
    ((await call('GET', url)).json().data as { id: string }[]).map((l) => l.id)

  // ── catálogos ──────────────────────────────────────────────────────────────
  it('sirve las categorías y marcas sembradas con los IDs de Supabase', async () => {
    const cats = (await call('GET', '/catalog/categories')).json().data
    expect(cats).toHaveLength(8)
    expect(cats.find((c: { id: string }) => c.id === AVIACION).name).toBe('Aviación')
    expect((await call('GET', '/catalog/brands')).json().data).toHaveLength(9)
  })

  it('"Otra marca" deduplica por nombre sin tildes ni mayúsculas', async () => {
    const u = await createTestUser(db)
    expect((await call('POST', '/catalog/brands', undefined, { name: 'X' })).statusCode).toBe(401)
    const a = (await call('POST', '/catalog/brands', u.cookie, { name: '  Hobby  Boss ' })).json()
      .data.id
    const b = (await call('POST', '/catalog/brands', u.cookie, { name: 'HOBBY BOSS' })).json().data
      .id
    expect(a).toBe(b)
    expect(
      (await call('POST', '/catalog/brands', u.cookie, { name: 'Tamiya' })).json().data.id,
    ).toBe(TAMIYA)
  })

  // ── subida de fotos ───────────────────────────────────────────────────────
  it('la foto se guarda como WebP de 1600 px + miniatura, sin metadatos EXIF', async () => {
    const u = await createTestUser(db)
    const url = await uploadPhoto(u.cookie)
    expect(url).toMatch(new RegExp(`^/uploads/photos/${u.id}/[0-9a-f-]{36}\\.webp$`))

    const file = join(uploadsDir, url.replace('/uploads/', ''))
    const big = await sharp(await readFile(file)).metadata()
    expect(big.format).toBe('webp')
    expect(big.width).toBe(1200) // sin agrandar
    expect(big.exif).toBeUndefined()
    const small = await sharp(await readFile(file.replace('.webp', '-sm.webp'))).metadata()
    expect(small.width).toBe(600)

    // Se sirve desde /uploads con caché larga.
    const served = await app.inject({ method: 'GET', url })
    expect(served.statusCode).toBe(200)
    expect(served.headers['cache-control']).toContain('immutable')
  })

  it('rechaza ficheros que no son imágenes y exige sesión', async () => {
    const u = await createTestUser(db)
    const body = multipart(Buffer.from('<?php echo "hola"; ?>'), 'foto.jpg')
    const res = await app.inject({
      method: 'POST',
      url: '/api/uploads/photo',
      payload: body.payload,
      headers: { ...body.headers, origin: TEST_ORIGIN, cookie: u.cookie },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('invalid_image')

    const anon = await app.inject({
      method: 'POST',
      url: '/api/uploads/photo',
      payload: body.payload,
      headers: { ...body.headers, origin: TEST_ORIGIN },
    })
    expect(anon.statusCode).toBe(401)
  })

  // ── anuncios: visibilidad ─────────────────────────────────────────────────
  it('Free: el anuncio tarda 24 h en ser público, pero su dueño lo ve ya', async () => {
    const u = await createTestUser(db)
    const res = await newListing(u.cookie)
    expect(res.statusCode, res.body).toBe(200)
    const listing = res.json().data
    const delayH = (new Date(listing.visible_at).getTime() - Date.now()) / 3_600_000
    expect(delayH).toBeGreaterThan(23.9)

    expect(await publicIds()).not.toContain(listing.id)
    expect((await call('GET', `/listings/${listing.id}`)).statusCode).toBe(404)
    expect((await call('GET', `/listings/${listing.id}`, u.cookie)).statusCode).toBe(200)
    expect((await call('GET', '/listings/mine', u.cookie)).json().data).toHaveLength(1)

    await makeVisibleNow(listing.id)
    expect(await publicIds()).toContain(listing.id)
  })

  it('PRO: publicación inmediata y sin límite de anuncios', async () => {
    const u = await createTestUser(db, { tier: 'pro' })
    const a = (await newListing(u.cookie)).json().data
    const b = await newListing(u.cookie)
    expect(b.statusCode).toBe(200)
    expect(await publicIds()).toEqual(expect.arrayContaining([a.id, b.json().data.id]))
  })

  it('el contenido de un usuario suspendido desaparece del público; el admin lo sigue viendo', async () => {
    const u = await createTestUser(db, { tier: 'pro' })
    const admin = await createTestUser(db, { admin: true })
    const l = (await newListing(u.cookie)).json().data
    await db
      .insertInto('user_suspensions')
      .values({ user_id: u.id, reason: 'spam', suspended_by: admin.id })
      .execute()

    expect(await publicIds()).not.toContain(l.id)
    expect((await call('GET', `/listings/${l.id}`)).statusCode).toBe(404)
    expect((await call('GET', `/listings/${l.id}`, admin.cookie)).statusCode).toBe(200)
  })

  it('filtra por texto ignorando tildes, por precio y ordena', async () => {
    const u = await createTestUser(db, { tier: 'pro' })
    await newListing(u.cookie, { title: 'Avión Zero 1:72', price_cents: 1000 })
    await newListing(u.cookie, { title: 'Tanque Tiger', price_cents: 5000 })
    const found = (await call('GET', '/listings?q=avion')).json().data
    expect(found.map((l: { title: string }) => l.title)).toEqual(['Avión Zero 1:72'])
    const cheap = (await call('GET', '/listings?maxPrice=2000')).json().data
    expect(cheap).toHaveLength(1)
    const sorted = (await call('GET', '/listings?sort=price_desc')).json().data
    expect(sorted.map((l: { price_cents: number }) => l.price_cents)).toEqual([5000, 1000])
  })

  // ── anuncios: plan ────────────────────────────────────────────────────────
  it('Free: 1 anuncio activo; al venderlo deja hueco; reactivarlo vuelve a ocuparlo', async () => {
    const u = await createTestUser(db)
    const first = (await newListing(u.cookie)).json().data
    const second = await newListing(u.cookie)
    expect(second.statusCode).toBe(403)
    expect(second.json().error.code).toBe('plan_limit')

    expect(
      (await call('PATCH', `/listings/${first.id}`, u.cookie, { status: 'sold' })).statusCode,
    ).toBe(200)
    const third = (await newListing(u.cookie)).json().data
    expect(third.id).toBeTruthy()

    const back = await call('PATCH', `/listings/${first.id}`, u.cookie, { status: 'active' })
    expect(back.statusCode).toBe(403)
    expect(back.json().error.code).toBe('plan_limit')
  })

  it('Free: máximo 2 fotos', async () => {
    const u = await createTestUser(db)
    const photos = [
      await uploadPhoto(u.cookie),
      await uploadPhoto(u.cookie),
      await uploadPhoto(u.cookie),
    ]
    const res = await newListing(u.cookie, { photos })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('photo_limit')
  })

  it('no se pueden usar fotos de otro usuario ni URLs externas', async () => {
    const owner = await createTestUser(db)
    const thief = await createTestUser(db)
    const foreign = await uploadPhoto(owner.cookie)
    for (const photos of [[foreign], ['https://web-ajena.example/foto.jpg']]) {
      const res = await newListing(thief.cookie, { photos })
      expect(res.statusCode).toBe(400)
      expect(res.json().error.code).toBe('invalid_photo')
    }
  })

  // ── anuncios: dueño y moderación ──────────────────────────────────────────
  it('solo el dueño (o un admin) edita; al quitar una foto se borra del disco', async () => {
    const u = await createTestUser(db, { tier: 'pro' })
    const other = await createTestUser(db)
    const p1 = await uploadPhoto(u.cookie)
    const p2 = await uploadPhoto(u.cookie)
    const l = (await newListing(u.cookie, { photos: [p1, p2] })).json().data

    expect(
      (await call('PATCH', `/listings/${l.id}`, other.cookie, { title: 'Mío' })).statusCode,
    ).toBe(404)

    const res = await call('PATCH', `/listings/${l.id}`, u.cookie, {
      title: 'Spitfire revisado',
      photos: [p2],
    })
    expect(res.json().data).toMatchObject({ title: 'Spitfire revisado', photos: [p2] })
    expect((await app.inject({ method: 'GET', url: p1 })).statusCode).toBe(404)
    expect((await app.inject({ method: 'GET', url: p2 })).statusCode).toBe(200)
  })

  it('retirado por moderación: el dueño no puede reactivarlo ni borrarlo; el admin sí', async () => {
    const u = await createTestUser(db, { tier: 'pro' })
    const admin = await createTestUser(db, { admin: true })
    const l = (await newListing(u.cookie)).json().data
    await db
      .updateTable('listings')
      .set({ status: 'archived', previous_status: 'active' })
      .where('id', '=', l.id)
      .execute()

    const reactivate = await call('PATCH', `/listings/${l.id}`, u.cookie, { status: 'active' })
    expect(reactivate.statusCode).toBe(403)
    expect(reactivate.json().error.code).toBe('moderated')
    expect((await call('DELETE', `/listings/${l.id}`, u.cookie)).json().error.code).toBe(
      'moderated',
    )
    // Editar el texto sí puede (corregir lo que motivó la retirada).
    expect(
      (await call('PATCH', `/listings/${l.id}`, u.cookie, { title: 'Título corregido' }))
        .statusCode,
    ).toBe(200)

    expect((await call('DELETE', `/listings/${l.id}`, admin.cookie)).statusCode).toBe(200)
  })

  it('borrar un anuncio borra sus fotos del disco y sus favoritos', async () => {
    const u = await createTestUser(db, { tier: 'pro' })
    const fan = await createTestUser(db)
    const l = (await newListing(u.cookie)).json().data
    await call('PUT', `/favorites/${l.id}`, fan.cookie)

    expect((await call('DELETE', `/listings/${l.id}`, u.cookie)).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: l.photos[0] })).statusCode).toBe(404)
    expect((await call('GET', '/favorites/ids', fan.cookie)).json().data).toEqual([])
  })

  it('cuenta visitas (no de borradores) y favoritos sin revelar quién', async () => {
    const u = await createTestUser(db, { tier: 'pro' })
    const fan = await createTestUser(db)
    const l = (await newListing(u.cookie)).json().data
    await call('POST', `/listings/${l.id}/view`)
    await call('POST', `/listings/${l.id}/view`)
    expect((await call('GET', `/listings/${l.id}`)).json().data.views).toBe(2)

    await call('PUT', `/favorites/${l.id}`, fan.cookie)
    await call('PUT', `/favorites/${l.id}`, fan.cookie) // idempotente
    expect((await call('GET', `/listings/${l.id}/favorite-count`)).json().data).toEqual({
      count: 1,
    })
  })

  // ── favoritos ─────────────────────────────────────────────────────────────
  it('favoritos: solo de anuncios visibles; los retirados desaparecen de la lista', async () => {
    const seller = await createTestUser(db) // Free: su anuncio aún no es público
    const fan = await createTestUser(db)
    const l = (await newListing(seller.cookie)).json().data
    expect((await call('PUT', `/favorites/${l.id}`, fan.cookie)).statusCode).toBe(404)

    await makeVisibleNow(l.id)
    expect((await call('PUT', `/favorites/${l.id}`, fan.cookie)).statusCode).toBe(200)
    expect((await call('GET', '/favorites/listings', fan.cookie)).json().data).toHaveLength(1)

    await call('PATCH', `/listings/${l.id}`, seller.cookie, { status: 'archived' })
    expect((await call('GET', '/favorites/listings', fan.cookie)).json().data).toHaveLength(0)
  })

  // ── peticiones ────────────────────────────────────────────────────────────
  it('peticiones: públicas al instante, 1 abierta en Free, cerrarla deja hueco', async () => {
    const u = await createTestUser(db)
    const body = {
      title: 'Busco Revell Bismarck 1:350',
      description: 'Completa, sin empezar.',
      max_price_cents: 9000,
      scale: '1:350',
      category_id: '1e45f15f-3b15-4060-8a43-df507c544cc4',
      brand_id: '17ac2d59-984e-485b-8788-23c70d02a9ae',
      accepted_conditions: ['sealed', 'opened'],
    }
    const r = (await call('POST', '/requests', u.cookie, body)).json().data
    expect(r.accepted_conditions).toEqual(['sealed', 'opened'])
    expect(await publicIds('/requests')).toContain(r.id)

    expect((await call('POST', '/requests', u.cookie, body)).json().error.code).toBe('plan_limit')
    await call('PATCH', `/requests/${r.id}`, u.cookie, { status: 'fulfilled' })
    expect(await publicIds('/requests')).not.toContain(r.id)
    expect((await call('POST', '/requests', u.cookie, body)).statusCode).toBe(200)
  })

  it('peticiones: ordenar por presupuesto deja al final las que no tienen', async () => {
    const u = await createTestUser(db, { tier: 'pro' })
    const base = { description: 'x'.repeat(12), category_id: AVIACION }
    await call('POST', '/requests', u.cookie, {
      ...base,
      title: 'Sin presupuesto',
      max_price_cents: null,
    })
    await call('POST', '/requests', u.cookie, { ...base, title: 'Barata', max_price_cents: 100 })
    await call('POST', '/requests', u.cookie, { ...base, title: 'Cara', max_price_cents: 900 })
    const titles = (sort: string) =>
      call('GET', `/requests?sort=${sort}`).then((r) =>
        r.json().data.map((x: { title: string }) => x.title),
      )
    expect(await titles('budget_desc')).toEqual(['Cara', 'Barata', 'Sin presupuesto'])
    expect(await titles('budget_asc')).toEqual(['Barata', 'Cara', 'Sin presupuesto'])
  })

  // ── perfiles y plan ───────────────────────────────────────────────────────
  it('perfil: lo público no incluye email ni preferencias; el username es único', async () => {
    const a = await createTestUser(db)
    const b = await createTestUser(db)
    const pub = (await call('GET', `/profiles?ids=${a.id},${b.id}`)).json().data
    expect(pub).toHaveLength(2)
    expect(Object.keys(pub[0]).sort()).toEqual(
      ['avatar_url', 'created_at', 'display_name', 'id', 'location', 'username'].sort(),
    )

    const saved = await call('PATCH', '/profile', a.cookie, {
      username: 'maqueton',
      bio: 'Hola',
      notify_email: false,
    })
    expect(saved.json().data).toMatchObject({
      username: 'maqueton',
      bio: 'Hola',
      notify_email: false,
    })
    const taken = await call('PATCH', '/profile', b.cookie, { username: 'maqueton' })
    expect(taken.statusCode).toBe(409)
    expect(taken.json().error.code).toBe('username_taken')
  })

  it('avatar: solo uno subido por el propio usuario; cambiarlo borra el anterior', async () => {
    const u = await createTestUser(db)
    const other = await createTestUser(db)
    const up = async (cookie: string) => {
      const body = multipart(await sampleJpeg())
      const r = await app.inject({
        method: 'POST',
        url: '/api/uploads/avatar',
        payload: body.payload,
        headers: { ...body.headers, origin: TEST_ORIGIN, cookie },
      })
      return r.json().data.url as string
    }
    const first = await up(u.cookie)
    const meta = await sharp(
      (await app.inject({ method: 'GET', url: first })).rawPayload,
    ).metadata()
    expect([meta.width, meta.height]).toEqual([512, 512])

    expect(
      (await call('PATCH', '/profile', other.cookie, { avatar_url: first })).json().error.code,
    ).toBe('invalid_avatar')
    await call('PATCH', '/profile', u.cookie, { avatar_url: first })
    const second = await up(u.cookie)
    await call('PATCH', '/profile', u.cookie, { avatar_url: second })
    expect((await app.inject({ method: 'GET', url: first })).statusCode).toBe(404)
  })

  it('plan: Free sin suscripción, PRO con una activa; las insignias solo muestran planes de pago', async () => {
    const free = await createTestUser(db)
    const pro = await createTestUser(db, { tier: 'pro' })
    expect((await call('GET', '/subscription', free.cookie)).json().data).toEqual({
      tier: 'free',
      paidTier: 'free',
    })
    expect((await call('GET', '/subscription', pro.cookie)).json().data).toEqual({
      tier: 'pro',
      paidTier: 'pro',
    })
    expect(
      (await call('GET', `/subscription/public-tiers?ids=${free.id},${pro.id}`)).json().data,
    ).toEqual({
      [pro.id]: 'pro',
    })
  })
})
