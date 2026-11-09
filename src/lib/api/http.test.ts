import { describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/errors'
import { jsonResponse } from '@/test/setup'
import { api } from './http'

describe('cliente de la API', () => {
  it('devuelve `data` y envía JSON con POST cuando hay cuerpo', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, data: { id: 1 }, error: null }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api('/cosas', { body: { a: 1 } })).resolves.toEqual({ id: 1 })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/cosas',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: '{"a":1}',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

  it('usa GET sin cuerpo cuando no hay datos', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, data: [], error: null }))
    vi.stubGlobal('fetch', fetchMock)
    await api('/cosas')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/cosas',
      expect.objectContaining({ method: 'GET', body: undefined }),
    )
  })

  it('convierte `ok: false` en AppError con el mensaje y el código del servidor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            ok: false,
            data: null,
            error: { code: 'email_not_confirmed', message: 'Confirma tu email.' },
          },
          403,
        ),
      ),
    )
    const err = await api('/auth/login', { body: {} }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err).toMatchObject({ message: 'Confirma tu email.', code: 'email_not_confirmed' })
  })

  it('da un mensaje comprensible si no hay conexión o la respuesta no es JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    )
    await expect(api('/x')).rejects.toMatchObject({
      code: 'network',
      message: expect.stringMatching(/conectar/),
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>502</html>', { status: 502 })),
    )
    await expect(api('/x')).rejects.toMatchObject({ code: 'http_502' })
  })
})
