import { sql } from 'kysely'
import { buildApp } from '../app'
import { loadConfig, type Config } from '../config'
import { createDb, type Db } from '../db/client'
import { migrateToLatest } from '../db/migrate'

/** URL de la base de datos de pruebas, o undefined si no hay (se omiten los tests). */
export const TEST_DB_URL = process.env.DATABASE_URL_TEST

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
  const { rows } = await sql<{ name: string }>`
    SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()
  `.execute(db)
  await sql`SET FOREIGN_KEY_CHECKS = 0`.execute(db)
  for (const { name } of rows) await sql`DROP TABLE IF EXISTS ${sql.table(name)}`.execute(db)
  await sql`SET FOREIGN_KEY_CHECKS = 1`.execute(db)
  await migrateToLatest(db)
  return db
}

export async function testApp(db: Db, overrides: Partial<Config> = {}) {
  return buildApp({ config: testConfig(overrides), db })
}
