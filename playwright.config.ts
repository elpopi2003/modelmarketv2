import { defineConfig, devices } from '@playwright/test'

/**
 * Tests e2e de los flujos públicos (sin autenticación). Arrancan el dev server de Vite
 * y navegan como un visitante real. Los flujos autenticados (publicar, mensajería,
 * checkout) se añadirán cuando se decida la estrategia de cuentas de prueba.
 *
 * `reuseExistingServer` aprovecha un `npm run dev` ya levantado en local; en CI arranca uno.
 */
export default defineConfig({
  testDir: './e2e',
  // Serial: el dev server de Vite compila bajo demanda y varias navegaciones en paralelo
  // lo saturan (algunas abortan). La suite es pequeña; en serie es rápida y fiable.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
