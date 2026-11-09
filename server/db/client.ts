import { Kysely, MysqlDialect, sql } from 'kysely'
import { createPool } from 'mysql2'
import type { Database } from './schema'

export type Db = Kysely<Database>

/**
 * Crea el cliente Kysely sobre un pool de mysql2 (válido para MariaDB).
 *
 * - `timezone: 'Z'`: todas las fechas viajan en UTC; la sesión de MariaDB también se fija
 *   en UTC para que `CURRENT_TIMESTAMP` y los DATETIME guardados sean coherentes.
 * - `dateStrings: false`: DATETIME llega como `Date` de JS.
 * - `supportBigNumbers`/`bigNumberStrings`: los BIGINT (contadores) llegan como string
 *   en lugar de perder precisión; se convierten explícitamente donde haga falta.
 */
export function createDb(databaseUrl: string): Db {
  const pool = createPool({
    uri: databaseUrl,
    connectionLimit: 10,
    timezone: 'Z',
    charset: 'utf8mb4_unicode_ci',
    supportBigNumbers: true,
    bigNumberStrings: true,
  })
  pool.on('connection', (conn) => {
    conn.query("SET time_zone = '+00:00'")
  })
  return new Kysely<Database>({ dialect: new MysqlDialect({ pool }) })
}

/** Comprueba que la base de datos responde (lo usa /api/health). */
export async function pingDb(db: Db): Promise<boolean> {
  try {
    await sql`SELECT 1`.execute(db)
    return true
  } catch {
    return false
  }
}
