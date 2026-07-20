import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { MaybeLink } from './maybe-link'

function renderIn(ui: React.ReactNode) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {ui}
    </MemoryRouter>,
  )
}

describe('MaybeLink', () => {
  it('enlaza cuando hay destino', () => {
    renderIn(<MaybeLink to="/producto/abc">Panzer IV</MaybeLink>)
    const enlace = screen.getByRole('link', { name: 'Panzer IV' })
    expect(enlace).toHaveAttribute('href', '/producto/abc')
  })

  it('no enlaza cuando el asunto ya no está disponible', () => {
    renderIn(<MaybeLink to={null}>Anuncio no disponible</MaybeLink>)
    // Lo importante no es que se vea el texto, sino que NO haya nada que pulsar:
    // un enlace ahí llevaría a "no encontrado" y parecería un fallo de la aplicación.
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Anuncio no disponible')).toBeInTheDocument()
  })

  it('conserva las clases en ambos casos, para no descuadrar el diseño', () => {
    const { unmount } = renderIn(
      <MaybeLink to="/x" className="truncate">
        con destino
      </MaybeLink>,
    )
    expect(screen.getByText('con destino')).toHaveClass('truncate')
    unmount()

    renderIn(
      <MaybeLink to={null} className="truncate">
        sin destino
      </MaybeLink>,
    )
    expect(screen.getByText('sin destino')).toHaveClass('truncate')
  })
})
