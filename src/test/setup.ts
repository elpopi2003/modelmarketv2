import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

/**
 * `fetch` simulado para la API propia: por defecto, visitante sin sesión
 * (`GET /api/auth/me` → null) y cualquier otra ruta responde `{ ok: true, data: null }`.
 * Un test puede sustituirlo con `vi.stubGlobal('fetch', ...)`.
 */
export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse({ ok: true, data: null, error: null })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
