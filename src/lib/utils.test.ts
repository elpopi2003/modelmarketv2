import { describe, expect, it } from 'vitest'
import { matchesSearch, normalizeForSearch } from './utils'

describe('normalizeForSearch', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(normalizeForSearch('Aviación')).toBe('aviacion')
    expect(normalizeForSearch('Vehículos Militares')).toBe('vehiculos militares')
  })

  // La ñ también se reduce a n. Es deliberado: en un buscador conviene ser indulgente,
  // porque mucha gente escribe «espana» o «muneco» sin la eñe y espera encontrarlo.
  it('reduce la eñe a n, a propósito, para no fallar a quien no la escribe', () => {
    expect(normalizeForSearch('ESPAÑA')).toBe('espana')
    expect(matchesSearch('muneco', ['Muñeco Vudú'])).toBe(true)
    expect(matchesSearch('muñeco', ['Muñeco Vudú'])).toBe(true)
  })
})

describe('matchesSearch', () => {
  const campos = ['Academy F-15I Ra’am', 'aviacion@example.com', null, undefined]

  it('encuentra sin tildes lo que sí las tiene', () => {
    expect(matchesSearch('aviacion', ['Aviación'])).toBe(true)
    expect(matchesSearch('AVIACIÓN', ['aviacion'])).toBe(true)
  })

  it('busca en varios campos e ignora los nulos', () => {
    expect(matchesSearch('academy', campos)).toBe(true)
    expect(matchesSearch('example.com', campos)).toBe(true)
    expect(matchesSearch('tamiya', campos)).toBe(false)
  })

  it('un término vacío no filtra nada', () => {
    expect(matchesSearch('', campos)).toBe(true)
    expect(matchesSearch('   ', campos)).toBe(true)
  })
})
