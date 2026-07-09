import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '@/App'

describe('App', () => {
  it('renderiza el hero de la landing', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /modelmarket/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /explorar anuncios/i })).toBeInTheDocument()
  })
})
