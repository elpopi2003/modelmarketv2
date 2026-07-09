import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '@/App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
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
})
