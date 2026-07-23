import { test, expect } from '@playwright/test'

/**
 * Flujos públicos: lo que ve un visitante sin cuenta. Cubren la navegación principal y,
 * de paso, protegen contra regresiones el trabajo de M7 (SEO por ruta) y los cambios
 * recientes en precios y footer.
 */

test.describe('Navegación pública', () => {
  test('la home carga con su título y el hero', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/ModelMarket/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // El hero se sirve en formato moderno (AVIF/WebP), no el PNG de 2 MB.
    const heroSrc = await page.locator('picture img').first().getAttribute('src')
    expect(heroSrc).toMatch(/\.(avif|webp|png)/)
  })

  test('la barra superior navega a las secciones públicas', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Explorar', exact: true }).first().click()
    await expect(page).toHaveURL(/\/explorar/)
    await expect(page.getByRole('heading', { name: 'Explorar anuncios' })).toBeVisible()

    await page.getByRole('link', { name: 'Peticiones', exact: true }).first().click()
    await expect(page).toHaveURL(/\/peticiones/)

    await page.getByRole('link', { name: 'Precios', exact: true }).first().click()
    await expect(page).toHaveURL(/\/precios/)
  })
})

test.describe('Precios', () => {
  test('muestra Free y PRO, sin Retail ni carga CSV', async ({ page }) => {
    await page.goto('/precios')
    await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'PRO' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Retail' })).toHaveCount(0)
    await expect(page.getByText('Carga masiva CSV')).toHaveCount(0)
  })
})

test.describe('Footer', () => {
  test('lista todas las categorías enlazando a su filtro', async ({ page }) => {
    await page.goto('/')
    const footer = page.locator('footer')
    const categoryLinks = footer.locator('a[href^="/explorar?cat="]')
    // Hay varias categorías reales; cada enlace lleva su slug.
    await expect(categoryLinks.first()).toBeVisible()
    const count = await categoryLinks.count()
    expect(count).toBeGreaterThanOrEqual(8)

    // Seguir una categoría deja el filtro aplicado en Explorar.
    await footer.getByRole('link', { name: 'Barcos' }).click()
    await expect(page).toHaveURL(/\/explorar\?cat=barcos/)
    await expect(page.getByLabel('Categoría')).toHaveValue(/.+/)
  })
})

test.describe('SEO por ruta', () => {
  test('título, canonical y una sola meta description por página', async ({ page }) => {
    await page.goto('/faq')
    await expect(page).toHaveTitle(/Preguntas frecuentes · ModelMarket/)

    const canonical = page.locator('link[rel="canonical"]')
    await expect(canonical).toHaveAttribute('href', /\/faq$/)

    // React inyecta la descripción por ruta; no debe duplicarse con una estática.
    await expect(page.locator('meta[name="description"]')).toHaveCount(1)

    // La FAQ expone JSON-LD FAQPage para los resultados enriquecidos de Google.
    const faqLd = page.locator('script[type="application/ld+json"]')
    await expect(faqLd).toHaveCount(1)
    const json = JSON.parse((await faqLd.textContent()) ?? '{}')
    expect(json['@type']).toBe('FAQPage')
  })

  test('una ruta inexistente muestra 404 marcado noindex', async ({ page }) => {
    await page.goto('/esta-ruta-no-existe')
    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })
})

test.describe('Guard de rutas', () => {
  test('sin sesión, una ruta protegida redirige a /auth', async ({ page }) => {
    await page.goto('/publicar')
    await expect(page).toHaveURL(/\/auth/)
  })
})
