import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import type { FastifyInstance } from 'fastify'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import {
  TEST_DB_URL,
  TEST_ORIGIN,
  createTestUser,
  resetTestDb,
  tempUploadsDir,
  testApp,
} from '../test/helpers'

// Beta sin pagos (BETA_ALL_PRO=true): todas las cuentas tienen las ventajas PRO.
describe.skipIf(!TEST_DB_URL)('modo beta: PRO gratis para todos', () => {
  let db: Db
  let app: FastifyInstance
  let uploadsDir: string

  beforeAll(async () => {
    db = await resetTestDb()
    uploadsDir = await tempUploadsDir()
    app = await testApp(db, { UPLOADS_DIR: uploadsDir, BETA_ALL_PRO: true })
  })
  afterAll(async () => {
    await app?.close()
    await db?.destroy()
    if (uploadsDir) await rm(uploadsDir, { recursive: true, force: true })
  })

  const call = (method: 'GET' | 'POST', url: string, cookie?: string, payload?: object) =>
    app.inject({
      method,
      url: `/api${url}`,
      payload,
      headers: { origin: TEST_ORIGIN, ...(cookie ? { cookie } : {}) },
    })

  async function photo(cookie: string) {
    const img = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#888' } })
      .jpeg()
      .toBuffer()
    const boundary = `----mm${randomUUID()}`
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="f.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
      ),
      img,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ])
    const res = await app.inject({
      method: 'POST',
      url: '/api/uploads/photo',
      payload,
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        origin: TEST_ORIGIN,
        cookie,
      },
    })
    return res.json().data.url as string
  }

  it('la plataforma anuncia el modo beta sin sesión', async () => {
    expect((await call('GET', '/platform')).json().data).toEqual({ betaAllPro: true })
  })

  it('una cuenta sin pagar es PRO a efectos de reglas, pero su plan pagado sigue siendo Free', async () => {
    const u = await createTestUser(db)
    expect((await call('GET', '/subscription', u.cookie)).json().data).toEqual({
      tier: 'pro',
      paidTier: 'free',
    })
  })

  it('publica sin límite y sin el retardo de 24 h del plan Free', async () => {
    const u = await createTestUser(db)
    for (let i = 0; i < 2; i++) {
      const res = await call('POST', '/listings', u.cookie, {
        title: `Anuncio beta ${i}`,
        price_cents: 1000,
        condition: 'sealed',
        decals: 'perfect',
        photos: [await photo(u.cookie)],
      })
      expect(res.statusCode, res.body).toBe(200)
      expect(new Date(res.json().data.visible_at).getTime()).toBeLessThanOrEqual(Date.now())
    }
  })

  it('las insignias siguen mostrando solo planes de pago reales', async () => {
    const free = await createTestUser(db)
    const paid = await createTestUser(db, { tier: 'pro' })
    expect(
      (await call('GET', `/subscription/public-tiers?ids=${free.id},${paid.id}`)).json().data,
    ).toEqual({
      [paid.id]: 'pro',
    })
  })
})
