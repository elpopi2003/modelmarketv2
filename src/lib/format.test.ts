import { describe, expect, it } from 'vitest'
import { CONDITION_LABELS, formatPrice, STATUS_LABELS } from './format'

describe('formatPrice', () => {
  it('convierte céntimos a euros con formato es-ES', () => {
    const result = formatPrice(499)
    expect(result).toContain('4,99')
    expect(result).toContain('€')
  })

  it('formatea el cero', () => {
    expect(formatPrice(0)).toContain('0,00')
  })

  it('respeta otra moneda', () => {
    expect(formatPrice(1000, 'USD', 'en-US')).toBe('$10.00')
  })
})

describe('etiquetas', () => {
  it('cubre todas las condiciones y estados', () => {
    expect(CONDITION_LABELS.like_new).toBe('Como nuevo')
    expect(STATUS_LABELS.active).toBe('Activo')
    expect(Object.keys(CONDITION_LABELS)).toHaveLength(4)
    expect(Object.keys(STATUS_LABELS)).toHaveLength(4)
  })
})
