import { sql } from 'kysely'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { TEST_DB_URL, resetTestDb } from '../test/helpers'
import { layout } from './layout'
import { MAX_ATTEMPTS, enqueueEmail, processOutbox } from './outbox'
import { memoryTransport } from './transport'

const ctx = { appUrl: 'https://modelmarket.es', logoUrl: 'https://modelmarket.es/brand/logo.png' }
const content = layout(
  { subject: 'Hola', heading: 'Hola <Ana>', cta: { label: 'Entrar', href: '/auth' } },
  ctx,
)

describe('layout de email', () => {
  it('incluye versión de texto con el enlace absoluto y sin etiquetas', () => {
    expect(content.text).toContain('Entrar: https://modelmarket.es/auth')
    expect(content.text).not.toMatch(/<[a-z]/i)
    expect(content.html).toContain('href="https://modelmarket.es/auth"')
    expect(content.html).toContain('src="https://modelmarket.es/brand/logo.png"')
  })
})

describe.skipIf(!TEST_DB_URL)('cola de emails', () => {
  let db: Db
  beforeAll(async () => {
    db = await resetTestDb()
  })
  afterAll(() => db?.destroy())
  beforeEach(async () => {
    await db.deleteFrom('email_outbox').execute()
  })

  const opts = (transport: ReturnType<typeof memoryTransport>) => ({
    transport,
    from: 'ModelMarket <info@modelmarket.es>',
    defaultReplyTo: 'hola@modelmarket.es',
  })

  it('envía lo pendiente con remitente, Reply-To y cabeceras, y lo marca enviado', async () => {
    const id = await enqueueEmail(db, {
      to: 'ana@test.local',
      content,
      kind: 'test',
      headers: { 'List-Unsubscribe': '<https://modelmarket.es/configuracion>' },
    })
    const t = memoryTransport()
    expect(await processOutbox(db, opts(t))).toEqual({ sent: 1, failed: 0 })
    expect(t.sent[0]).toMatchObject({
      from: 'ModelMarket <info@modelmarket.es>',
      to: 'ana@test.local',
      replyTo: 'hola@modelmarket.es',
      subject: 'Hola',
      headers: { 'List-Unsubscribe': '<https://modelmarket.es/configuracion>' },
    })
    const row = await db
      .selectFrom('email_outbox')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
    expect(row.status).toBe('sent')
    expect(row.sent_at).toBeInstanceOf(Date)

    // Un segundo pase no lo reenvía.
    expect(await processOutbox(db, opts(t))).toEqual({ sent: 0, failed: 0 })
  })

  it('si falla, reintenta más tarde; tras agotar los intentos lo marca fallido', async () => {
    const id = await enqueueEmail(db, { to: 'b@test.local', content, kind: 'test' })
    const t = memoryTransport()
    t.failNext = 1
    expect(await processOutbox(db, opts(t))).toEqual({ sent: 0, failed: 1 })

    let row = await db
      .selectFrom('email_outbox')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
    expect(row.status).toBe('pending')
    expect(row.attempts).toBe(1)
    expect(row.last_error).toContain('fallo simulado')
    expect(row.send_after.getTime()).toBeGreaterThan(Date.now())
    // Aún no toca: no se reintenta antes de tiempo.
    expect(await processOutbox(db, opts(t))).toEqual({ sent: 0, failed: 0 })

    // Adelanta el reloj y agota los intentos.
    t.failNext = 99
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      await db
        .updateTable('email_outbox')
        .set({ send_after: sql<Date>`NOW(3) - INTERVAL 1 SECOND` })
        .execute()
      await processOutbox(db, opts(t))
    }
    row = await db
      .selectFrom('email_outbox')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
    expect(row.status).toBe('failed')
    expect(row.attempts).toBe(MAX_ATTEMPTS)
  })

  it('rescata envíos que se quedaron a medias por un reinicio', async () => {
    const id = await enqueueEmail(db, { to: 'c@test.local', content, kind: 'test' })
    await db
      .updateTable('email_outbox')
      .set({ status: 'sending', send_after: sql<Date>`NOW(3) - INTERVAL 11 MINUTE` })
      .execute()
    const t = memoryTransport()
    expect(await processOutbox(db, opts(t))).toEqual({ sent: 1, failed: 0 })
    const row = await db
      .selectFrom('email_outbox')
      .select('status')
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
    expect(row.status).toBe('sent')
  })
})
