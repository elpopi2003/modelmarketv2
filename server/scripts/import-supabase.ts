import { existsSync } from 'node:fs'
import { loadConfig } from '../config'
import { createDb } from '../db/client'
import { migrateToLatest } from '../db/migrate'
import { importData } from '../migration/import'
import { readSupabase, summarize } from '../migration/source'

/**
 * Migración única de v2 (Supabase) a v3 (MariaDB del VPS).
 *
 *   npm run db:import-supabase -- --dry-run   solo lee Supabase y cuenta filas
 *   npm run db:import-supabase                importa en una base de datos vacía
 *   npm run db:import-supabase -- --wipe      vacía antes el destino (ensayos en staging)
 *
 * Variables (en el entorno o en server/.env):
 *   SUPABASE_DB_URL   cadena del "Session pooler" de Supabase, con la contraseña de la BD
 *   SUPABASE_CA_FILE  ruta del certificado raíz de Supabase (Database → SSL Configuration)
 *   DATABASE_URL o DB_HOST/DB_USER/DB_PASSWORD/DB_NAME, y UPLOADS_DIR   del destino
 */
if (existsSync('server/.env')) process.loadEnvFile('server/.env')

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const wipe = args.has('--wipe')

const supabaseUrl = process.env.SUPABASE_DB_URL
if (!supabaseUrl) {
  console.error('Falta SUPABASE_DB_URL (cadena del Session pooler de Supabase).')
  process.exit(1)
}

console.log('Leyendo Supabase…')
const data = await readSupabase(supabaseUrl, process.env.SUPABASE_CA_FILE)
console.table(summarize(data))
if (dryRun) {
  console.log('--dry-run: no se ha escrito nada.')
  process.exit(0)
}

const config = loadConfig()
const db = createDb(config.DATABASE_URL)
try {
  await migrateToLatest(db)
  const report = await importData(db, data, {
    uploadsDir: config.UPLOADS_DIR,
    wipe,
    log: (m) => console.log(m),
  })
  console.log('\nImportado:')
  console.table(report.counts)
  console.log(`Fotos migradas: ${report.photosMigrated}`)
  if (report.photosFailed.length) {
    console.log(`Fotos NO migradas (${report.photosFailed.length}):`)
    for (const f of report.photosFailed) console.log(`  - ${f.url} (${f.reason})`)
  }
  console.log(
    '\nListo. Comprueba entrando con una cuenta existente: su contraseña de v2 sigue valiendo.',
  )
} catch (err) {
  console.error('\nLa importación ha fallado y no se ha guardado nada:')
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await db.destroy()
}
