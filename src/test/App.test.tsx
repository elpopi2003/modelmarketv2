import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { jsonResponse } from '@/test/setup'
import { AuthProvider } from '@/hooks/useAuth'
import App from '@/App'

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[path]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App', () => {
  it('renderiza la landing en la home', () => {
    renderAt('/')
    expect(
      screen.getByRole('heading', { level: 1, name: /marketplace para coleccionistas/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /explorar catálogo/i })).toBeInTheDocument()
  })

  it('muestra 404 en rutas desconocidas', () => {
    renderAt('/ruta-inexistente')
    expect(screen.getByRole('heading', { name: /no encontrada/i })).toBeInTheDocument()
  })

  it('redirige a /auth al entrar en una ruta protegida sin sesión', async () => {
    renderAt('/dashboard')
    expect(await screen.findByText(/inicia sesión/i)).toBeInTheDocument()
  })

  it('el login enlaza con la recuperación de contraseña', async () => {
    renderAt('/auth')
    expect(await screen.findByRole('link', { name: /la has olvidado/i })).toHaveAttribute(
      'href',
      '/auth/recuperar',
    )
  })

  it('confirmar email llama a la API con el token del enlace y ofrece entrar', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) =>
      jsonResponse({
        ok: true,
        data: url.endsWith('/auth/me') ? null : { verified: true },
        error: null,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/auth/verificar?token=abc123abc123abc123abc123')

    expect(await screen.findByText(/tu cuenta ya está activa/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^entrar$/i })).toHaveAttribute('href', '/auth')
    const verifyCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/auth/verify-email')
    expect(verifyCalls).toHaveLength(1)
    expect(verifyCalls[0][1]).toMatchObject({ body: '{"token":"abc123abc123abc123abc123"}' })
  })

  it('un enlace de confirmación caducado muestra el error y permite pedir otro', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/auth/me')
          ? jsonResponse({ ok: true, data: null, error: null })
          : jsonResponse(
              {
                ok: false,
                data: null,
                error: { code: 'invalid_token', message: 'El enlace ha caducado.' },
              },
              400,
            ),
      ),
    )
    renderAt('/auth/verificar?token=caducado-caducado-caducado')
    expect(await screen.findByText('El enlace ha caducado.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar enlace nuevo/i })).toBeInTheDocument()
  })
})
