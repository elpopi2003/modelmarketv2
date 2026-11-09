import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

// Empaqueta el servidor (server/index.ts) en server-dist/index.mjs. Las dependencias de
// package.json quedan externas (se instalan con npm ci en el VPS); el código compartido
// con el frontend (src/lib/schemas…) sí se incluye, resolviendo el alias @/.
export default defineConfig({
  entry: { index: 'server/index.ts' },
  outDir: 'server-dist',
  format: ['esm'],
  outExtension: () => ({ js: '.mjs' }),
  platform: 'node',
  target: 'node22',
  tsconfig: 'server/tsconfig.json',
  sourcemap: true,
  clean: true,
  splitting: false,
  // Versión de package.json fijada al compilar (Passenger no define npm_package_version).
  define: { __APP_VERSION__: JSON.stringify(version) },
})
