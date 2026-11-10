import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import ExcelJS from 'exceljs'
import type { FastifyInstance } from 'fastify'
import { zipSync } from 'fflate'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { jsonArray } from '../db/json'
import {
  TEST_DB_URL,
  TEST_ORIGIN,
  createTestUser,
  resetTestDb,
  tempUploadsDir,
  testApp,
} from '../test/helpers'

const HEADER = [
  'Marca',
  'Referencia',
  'Nombre',
  'Escala',
  'Categoria',
  'Ano',
  'Estanteria',
  'Estado fisico',
  'Cantidad',
  'Ubicacion',
  'Precio pagado',
  'Precio medio',
  'Comprado el',
  'Notas',
  'Ficha',
  'Anadido el',
]
type Row = (string | number | null)[]
const row = (
  brand: string,
  ref: string,
  name: string,
  cat: string,
  price: number | null,
  extra: Partial<Record<'shelf' | 'cond' | 'qty' | 'notes', string | number>> = {},
): Row => [
  brand,
  ref,
  name,
  '1:48',
  cat,
  2015,
  extra.shelf ?? 'Por montar',
  extra.cond ?? null,
  extra.qty ?? 1,
  null,
  null,
  price,
  null,
  extra.notes ?? null,
  `https://www.scalemates.com/kits/${ref}`,
  '2026-11-05 14:29:55',
]

const ROWS: Row[] = [
  row('Tamiya', '24229', 'Porsche 911 GT3', 'Cars', 26.44),
  row('Meng Model', 'LS-021', 'F-4E Phantom II', 'Aircraft', 74.73, {
    qty: 3,
    notes: 'Máscaras y calcas extra',
  }),
  row('Bandai', '0196692', 'Snowspeeder', 'Space', 32, {
    shelf: 'En construccion',
    cond: 'Precintado',
  }),
  row('Bandai', '0194869', 'AT-ST', 'Other', 36.75),
  row('Kinetic', 'K48001', 'F-16 Kinetic', 'Aircraft', 41.5),
  row('Eduard', '1162', 'MiG-29UB', 'Aircraft', null), // sin precio
  row('Hasegawa', '07010', 'F-15C Eagle', 'Aircraft', 30), // sin imagen
]

async function excel(rows: Row[], header = HEADER) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Coleccion')
  ws.addRow(header)
  for (const r of rows) ws.addRow(r)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

async function jpg() {
  return sharp({ create: { width: 900, height: 500, channels: 3, background: '#c33' } })
    .jpeg()
    .toBuffer()
}

async function imagesZip() {
  const img = new Uint8Array(await jpg())
  return Buffer.from(
    zipSync({
      'Tamiya-24229.jpg': img, // marca-referencia
      'portadas/LS-021.jpg': img, // en subcarpeta, solo referencia
      '0196692.png': new Uint8Array(
        await sharp(await jpg())
          .png()
          .toBuffer(),
      ),
      '0194869.jpg': img,
      'K48001.jpeg': img,
      '1162.jpg': img,
      'leeme.txt': new TextEncoder().encode('no es una imagen'),
      '__MACOSX/._24229.jpg': img,
    }),
  )
}

function multipart(
  fields: Record<string, string>,
  files: Record<string, { name: string; data: Buffer }>,
) {
  const boundary = `----mm${randomUUID()}`
  const parts: Buffer[] = []
  for (const [k, v] of Object.entries(fields)) {
    parts.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`),
    )
  }
  for (const [k, f] of Object.entries(files)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${k}"; filename="${f.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
      ),
      f.data,
      Buffer.from('\r\n'),
    )
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`))
  return {
    payload: Buffer.concat(parts),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  }
}

describe.skipIf(!TEST_DB_URL)('importador masivo desde Excel', () => {
  let db: Db
  let app: FastifyInstance
  let uploadsDir: string
  let xlsx: Buffer
  let zip: Buffer

  beforeAll(async () => {
    db = await resetTestDb()
    uploadsDir = await tempUploadsDir()
    app = await testApp(db, { UPLOADS_DIR: uploadsDir })
    xlsx = await excel(ROWS)
    zip = await imagesZip()
  })
  afterAll(async () => {
    await app?.close()
    await db?.destroy()
    if (uploadsDir) await rm(uploadsDir, { recursive: true, force: true })
  })
  beforeEach(async () => {
    await db.deleteFrom('users').execute()
  })

  const send = (
    url: string,
    cookie: string | undefined,
    fields: Record<string, string>,
    files = { excel: { name: 'c.xlsx', data: xlsx }, zip: { name: 'i.zip', data: zip } },
  ) => {
    const m = multipart(fields, files)
    return app.inject({
      method: 'POST',
      url: `/api${url}`,
      payload: m.payload,
      headers: { ...m.headers, origin: TEST_ORIGIN, ...(cookie ? { cookie } : {}) },
    })
  }
  const options = {
    shippingAvailable: true,
    handDelivery: false,
    acceptsOffers: true,
    decals: 'perfect',
  }
  const commit = (
    cookie: string,
    ownerId: string,
    categories: Record<string, string | null> = {},
  ) =>
    send('/admin/import/commit', cookie, {
      payload: JSON.stringify({ ownerId, options, categories }),
    })

  it('solo administradores', async () => {
    const user = await createTestUser(db)
    expect((await send('/admin/import/preview', undefined, { ownerId: user.id })).statusCode).toBe(
      401,
    )
    expect(
      (await send('/admin/import/preview', user.cookie, { ownerId: user.id })).statusCode,
    ).toBe(403)
  })

  it('vista previa: qué entra y qué no, con su motivo, sin escribir nada', async () => {
    const admin = await createTestUser(db, { admin: true })
    const owner = await createTestUser(db)
    const res = await send('/admin/import/preview', admin.cookie, { ownerId: owner.id })
    expect(res.statusCode, res.body).toBe(200)
    const { rows, summary } = res.json().data
    const byTitle = (t: string) => rows.find((r: { title: string }) => r.title === t)

    expect(summary).toMatchObject({
      total: 7,
      toImport: 5,
      skipped: 2,
      needCategory: 1,
      newBrands: ['Bandai', 'Kinetic'],
      images: 6,
    })
    expect(byTitle('MiG-29UB')).toMatchObject({ status: 'skip', skipReason: 'Sin precio.' })
    expect(byTitle('F-15C Eagle')).toMatchObject({
      status: 'skip',
      skipReason: 'Sin imagen en el ZIP.',
    })
    expect(byTitle('F-4E Phantom II')).toMatchObject({
      brand: 'Meng',
      brandIsNew: false,
      quantity: 3,
      priceCents: 7473,
      condition: 'opened',
    })
    expect(byTitle('Snowspeeder')).toMatchObject({ condition: 'sealed' }) // Estado físico manda
    expect(byTitle('AT-ST')).toMatchObject({
      status: 'ok',
      needsCategory: true,
      categoryId: null,
      categorySource: 'Other',
    })
    expect(await db.selectFrom('listings').select('id').execute()).toHaveLength(0)
  })

  it('importa con la imagen de catálogo marcada, publicado ya y con la ficha en la descripción', async () => {
    const admin = await createTestUser(db, { admin: true })
    const owner = await createTestUser(db) // Free: aun así se publica al momento (acción de admin)
    const ficcion = '5491d5a0-3dfb-48a1-af71-d74b88f2213b'

    const missing = await commit(admin.cookie, owner.id)
    expect(missing.json().error.code).toBe('category_required')

    const res = await commit(admin.cookie, owner.id, { '5': ficcion }) // fila 5 = AT-ST
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().data).toMatchObject({ created: 5, newBrands: ['Bandai', 'Kinetic'] })
    expect(res.json().data.skipped).toHaveLength(2)

    const listings = await db
      .selectFrom('listings')
      .selectAll()
      .where('user_id', '=', owner.id)
      .execute()
    expect(listings).toHaveLength(5)
    const phantom = listings.find((l) => l.title === 'F-4E Phantom II')!
    const photos = jsonArray<string>(phantom.photos)
    expect(phantom.catalog_photo).toBe(photos[0])
    expect(phantom).toMatchObject({
      manufacturer_ref: 'LS-021',
      price_cents: 7473,
      shipping_inpost: true,
      hand_delivery: false,
      status: 'active',
    })
    expect(phantom.description).toContain('Máscaras y calcas extra')
    expect(phantom.description).toContain('Unidades disponibles: 3')
    expect(phantom.description).toContain('Ficha del kit: https://www.scalemates.com/kits/LS-021')
    expect(listings.find((l) => l.title === 'AT-ST')!.category_id).toBe(ficcion)

    // Público al momento, aunque el dueño sea Free.
    const pub = (await app.inject({ method: 'GET', url: '/api/listings' })).json().data
    expect(pub).toHaveLength(5)
    // La foto existe y se sirve.
    expect((await app.inject({ method: 'GET', url: photos[0] })).statusCode).toBe(200)
  })

  it('reimportar el mismo Excel no duplica: todo sale como "ya existe"', async () => {
    const admin = await createTestUser(db, { admin: true })
    const owner = await createTestUser(db)
    await commit(admin.cookie, owner.id, { '5': null })
    const again = await send('/admin/import/preview', admin.cookie, { ownerId: owner.id })
    const reasons = again.json().data.rows.map((r: { skipReason: string | null }) => r.skipReason)
    expect(reasons.filter((r: string) => r === 'Ya existe en esa cuenta.')).toHaveLength(5)
    expect((await commit(admin.cookie, owner.id)).json().error.code).toBe('nothing_to_import')
  })

  it('si el dueño quita la foto de catálogo, deja de estar marcada', async () => {
    const admin = await createTestUser(db, { admin: true })
    const owner = await createTestUser(db, { tier: 'pro' })
    await commit(admin.cookie, owner.id, { '5': null })
    const l = await db
      .selectFrom('listings')
      .selectAll()
      .where('title', '=', 'Porsche 911 GT3')
      .executeTakeFirstOrThrow()

    const up = multipart({}, { file: { name: 'f.jpg', data: await jpg() } })
    const own = (
      await app.inject({
        method: 'POST',
        url: '/api/uploads/photo',
        payload: up.payload,
        headers: { ...up.headers, origin: TEST_ORIGIN, cookie: owner.cookie },
      })
    ).json().data.url
    await app.inject({
      method: 'PATCH',
      url: `/api/listings/${l.id}`,
      payload: { photos: [own] },
      headers: { origin: TEST_ORIGIN, cookie: owner.cookie },
    })
    const after = await db
      .selectFrom('listings')
      .select('catalog_photo')
      .where('id', '=', l.id)
      .executeTakeFirstOrThrow()
    expect(after.catalog_photo).toBeNull()
  })

  it('rechaza un Excel sin las columnas obligatorias y uno que no es Excel', async () => {
    const admin = await createTestUser(db, { admin: true })
    const bad = await excel([['x', 'y']], ['Fabricante', 'Modelo'])
    const res = await send(
      '/admin/import/preview',
      admin.cookie,
      { ownerId: admin.id },
      { excel: { name: 'c.xlsx', data: bad }, zip: { name: 'i.zip', data: zip } },
    )
    expect(res.json().error.code).toBe('missing_columns')
    const notExcel = await send(
      '/admin/import/preview',
      admin.cookie,
      { ownerId: admin.id },
      { excel: { name: 'c.xlsx', data: Buffer.from('hola') }, zip: { name: 'i.zip', data: zip } },
    )
    expect(notExcel.json().error.code).toBe('invalid_excel')
  })
})
