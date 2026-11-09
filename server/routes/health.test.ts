import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type Db } from '../db/client'
import { TEST_DB_URL, resetTestDb, testApp } from '../test/helpers'

describe('GET /api/health sin base de datos', () => {
  // Puerto 1: la conexión se rechaza al instante, sin esperar timeouts.
  const db = createDb('mysql://nadie@127.0.0.1:1/none')
  afterAll(() => db.destroy())

  it('responde 503 con el formato de error homogéneo', async () => {
    const app = await testApp(db)
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({
      ok: false,
      data: null,
      error: { code: 'db_unavailable', message: 'La base de datos no responde.' },
    })
  })

  it('las rutas /api desconocidas devuelven 404 en el mismo formato', async () => {
    const app = await testApp(db)
    const res = await app.inject({ method: 'GET', url: '/api/no-existe' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ ok: false, error: { code: 'not_found' } })
  })
})

describe.skipIf(!TEST_DB_URL)('GET /api/health con MariaDB', () => {
  let db: Db
  beforeAll(async () => {
    db = await resetTestDb()
  })
  afterAll(() => db?.destroy())

  it('responde 200 cuando la base de datos está disponible', async () => {
    const app = await testApp(db)
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ ok: true, data: { status: 'ok', db: true }, error: null })
  })
})
