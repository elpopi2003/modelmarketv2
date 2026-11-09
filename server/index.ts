import { existsSync } from 'node:fs'
import { buildApp } from './app'
import { loadConfig } from './config'
import { createDb } from './db/client'
import { migrateToLatest } from './db/migrate'

/**
 * Punto de entrada del servidor.
 *
 *   npm run server:dev   → desarrollo (tsx, recarga al guardar), lee server/.env
 *   npm run server:build → empaqueta en server-dist/index.cjs (lo que ejecuta Plesk)
 *
 * En Plesk, Passenger intercepta `listen()` y asigna el puerto; PORT solo se usa en local.
 */
if (existsSync('server/.env')) process.loadEnvFile('server/.env')

const config = loadConfig()
const db = createDb(config.DATABASE_URL)

// Las migraciones pendientes se aplican al arrancar: el despliegue (git pull + build +
// reinicio) deja la base de datos al día sin un paso manual que olvidar.
const applied = await migrateToLatest(db)
const app = await buildApp({ config, db })
if (applied.length) app.log.info({ applied }, 'Migraciones aplicadas')

const shutdown = async (signal: string) => {
  app.log.info(`${signal}: cerrando`)
  await app.close()
  await db.destroy()
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

await app.listen({ port: config.PORT, host: '127.0.0.1' })
