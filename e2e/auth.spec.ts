import { test, expect, type Page } from '@playwright/test'

/**
 * Flujos que requieren sesión. El login se hace por la interfaz (rellenando el formulario),
 * como un usuario real.
 *
 * Las credenciales se leen de las variables de entorno E2E_EMAIL / E2E_PASSWORD; NUNCA se
 * escriben en el repo. Sin ellas, toda la suite se salta (así el resto de e2e sigue verde).
 * Usa una cuenta de PRUEBA dedicada:
 *
 *   E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
 */

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

/** Inicia sesión por la interfaz y espera a aterrizar en la zona autenticada. */
async function login(page: Page) {
  await page.goto('/auth')
  await page.locator('#login-email').fill(EMAIL!)
  await page.locator('#login-password').fill(PASSWORD!)
  // Hay dos "Entrar": la pestaña (fuera del form) y el submit. Se apunta al submit.
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click()
  // El login redirige a /dashboard (o al destino guardado).
  await expect(page).toHaveURL(/\/(dashboard|explorar|$)/, { timeout: 15_000 })
}

test.describe('Flujos autenticados', () => {
  test.skip(!EMAIL || !PASSWORD, 'Define E2E_EMAIL y E2E_PASSWORD para ejecutar estos tests')

  test('login por la interfaz lleva al panel', async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL(/\/dashboard/)
    // La barra autenticada ofrece publicar; el visitante anónimo no la ve.
    await expect(page.getByRole('link', { name: /Publicar/i }).first()).toBeVisible()
  })

  test('una ruta protegida (publicar) es accesible con sesión y muestra el formulario', async ({
    page,
  }) => {
    await login(page)
    await page.goto('/publicar')
    // No rebota a /auth: la sesión pasa el guard.
    await expect(page).toHaveURL(/\/publicar/)
    await expect(page.getByLabel('Título')).toBeVisible()
    // La escala es un desplegable (M-anterior) y el método de entrega muestra el aviso.
    await expect(page.locator('select#scale')).toBeVisible()
    await expect(page.getByText('Envíos disponibles')).toBeVisible()
    await expect(page.getByText('Aviso sobre los envíos')).toBeVisible()
  })
})
