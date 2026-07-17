import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
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
})
