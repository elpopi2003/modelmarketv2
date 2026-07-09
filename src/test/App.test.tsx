import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/hooks/useAuth'
import App from '@/App'

function renderAt(path: string) {
  return render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('App', () => {
  it('renderiza la landing en la home', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: /modelmarket/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /explorar anuncios/i })).toBeInTheDocument()
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
