import { randomUUID } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'kysely'
import { buildApp } from '../app'
import { createSession } from '../auth/sessions'
import { loadConfig, type Config } from '../config'
import { createDb, type Db } from '../db/client'
import { migrateToLatest } from '../db/migrate'
import type { TierName } from '../db/schema'

/** URL de la base de datos de pruebas, o undefined si no hay (se omiten los tests). */
export const TEST_DB_URL = process.env.DATABASE_URL_TEST

export const TEST_ORIGIN = 'http://localhost:5173'

/** Configuración mínima para tests. Nunca apunta a la base de datos de desarrollo. */
export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DB_URL ?? 'mysql://test@127.0.0.1:1/none',
    }),
    ...overrides,
  }
}

/**
 * Deja la base de datos de pruebas vacía y migrada desde cero. Se niega a actuar sobre
 * una base de datos cuyo nombre no termine en `_test`, para no borrar nada real.
 */
export async function resetTestDb(): Promise<Db> {
  if (!TEST_DB_URL) throw new Error('DATABASE_URL_TEST no definida')
  const dbName = new URL(TEST_DB_URL).pathname.slice(1)
  if (!dbName.endsWith('_test'))
    throw new Error(`Me niego a vaciar "${dbName}": no termina en _test`)

  const db = createDb(TEST_DB_URL)
  // Una sola conexión: FOREIGN_KEY_CHECKS es por sesión y los DROP deben ir por la misma.
  await db.connection().execute(async (conn) => {
    const { rows } = await sql<{ name: string }>`
      SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()
    `.execute(conn)
    await sql`SET FOREIGN_KEY_CHECKS = 0`.execute(conn)
    for (const { name } of rows) await sql`DROP TABLE IF EXISTS ${sql.table(name)}`.execute(conn)
    await sql`SET FOREIGN_KEY_CHECKS = 1`.execute(conn)
  })
  await migrateToLatest(db)
  return db
}

export async function testApp(db: Db, overrides: Partial<Config> = {}) {
  return buildApp({ config: testConfig(overrides), db })
}

/** Carpeta temporal para las subidas de un fichero de tests. */
export const tempUploadsDir = () => mkdtemp(join(tmpdir(), 'mm-uploads-'))

/**
 * Usuario de prueba ya verificado, con perfil y rol, y opcionalmente admin y/o con un plan
 * de pago activo. Devuelve su id y una cookie de sesión lista para `inject`.
 */
export async function createTestUser(
  db: Db,
  opts: { admin?: boolean; tier?: TierName; email?: string } = {},
) {
  const id = randomUUID()
  const email = opts.email ?? `u-${id.slice(0, 8)}@test.local`
  await db
    .insertInto('users')
    .values({ id, email, password_hash: null, email_verified_at: new Date(), last_login_at: null })
    .execute()
  await db
    .insertInto('profiles')
    .values({
      id,
      username: null,
      display_name: email.split('@')[0],
      avatar_url: null,
      bio: null,
      location: null,
    })
    .execute()
  await db
    .insertInto('user_roles')
    .values({ id: randomUUID(), user_id: id, role: 'user' })
    .execute()
  if (opts.admin) {
    await db
      .insertInto('user_roles')
      .values({ id: randomUUID(), user_id: id, role: 'admin' })
      .execute()
  }
  if (opts.tier && opts.tier !== 'free') {
    await db
      .insertInto('subscriptions')
      .values({
        id: randomUUID(),
        user_id: id,
        tier: opts.tier,
        status: 'active',
        stripe_customer_id: null,
        stripe_subscription_id: null,
        current_period_end: null,
      })
      .execute()
  }
  const { token } = await createSession(db, id, 30)
  return { id, email, cookie: `mm_session=${token}` }
}
