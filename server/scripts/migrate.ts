import { existsSync } from 'node:fs'
import { loadConfig } from '../config'
import { createDb } from '../db/client'
import { migrateDown, migrateToLatest } from '../db/migrate'

// npm run db:migrate   → aplica las migraciones pendientes
// npm run db:rollback  → deshace la última (solo desarrollo)
if (existsSync('server/.env')) process.loadEnvFile('server/.env')

const direction = process.argv[2] === 'down' ? 'down' : 'up'
const db = createDb(loadConfig().DATABASE_URL)
try {
  const done = direction === 'down' ? await migrateDown(db) : await migrateToLatest(db)
  console.log(done.length ? done.join('\n') : 'Nada que migrar: la base de datos está al día.')
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await db.destroy()
}
