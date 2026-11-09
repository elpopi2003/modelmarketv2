import { existsSync } from 'node:fs'

// Los tests del servidor leen DATABASE_URL_TEST de server/.env (local). Si no está
// definida, los tests de integración se omiten y solo corren los unitarios.
if (existsSync('server/.env')) process.loadEnvFile('server/.env')
