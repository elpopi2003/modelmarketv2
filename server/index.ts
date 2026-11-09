import { existsSync } from 'node:fs'
import { buildApp } from './app'
import { purgeExpiredSessions } from './auth/sessions'
import { loadConfig } from './config'
import { createDb } from './db/client'
import { migrateToLatest } from './db/migrate'
import { startOutboxWorker } from './email/outbox'
import { createTransport } from './email/transport'

/**
 * Punto de entrada del servidor.
 *
 *   npm run server:dev   → desarrollo (tsx, recarga al guardar), lee server/.env
 *   npm run server:build → empaqueta en server-dist/index.mjs (lo que ejecuta Plesk)
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

// Cola de emails: se procesa cada 5 s dentro del propio proceso.
const stopOutbox = startOutboxWorker(db, {
  transport: createTransport(config),
  from: config.MAIL_FROM,
  defaultReplyTo: config.MAIL_REPLY_TO,
  log: app.log,
})
app.log.info(`Emails: transporte "${config.MAIL_TRANSPORT}"`)

// Limpieza de sesiones caducadas, una vez por hora.
const purgeTimer = setInterval(() => {
  purgeExpiredSessions(db).catch((err) => app.log.error({ err }, 'Error limpiando sesiones'))
}, 3_600_000)
purgeTimer.unref()

const shutdown = async (signal: string) => {
  app.log.info(`${signal}: cerrando`)
  stopOutbox()
  clearInterval(purgeTimer)
  await app.close()
  await db.destroy()
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

await app.listen({ port: config.PORT, host: '127.0.0.1' })
