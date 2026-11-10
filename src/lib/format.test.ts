import { describe, expect, it } from 'vitest'
import {
  CONDITION_LABELS,
  DECALS_LABELS,
  formatPrice,
  pendingVisibilityLabel,
  formatPriceShort,
  STATUS_LABELS,
} from './format'

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

describe('formatPriceShort', () => {
  it('omite los decimales cuando el importe es entero', () => {
    expect(formatPriceShort(4000)).toBe('40€')
  })

  it('mantiene los decimales cuando los hay', () => {
    expect(formatPriceShort(1250)).toBe('12,50€')
  })

  it('delega en formatPrice para otras monedas', () => {
    expect(formatPriceShort(1000, 'USD', 'en-US')).toBe('$10.00')
  })
})

describe('etiquetas', () => {
  it('cubre la taxonomía de condición, calcas y estados', () => {
    expect(CONDITION_LABELS.sealed).toBe('Precintado')
    expect(CONDITION_LABELS.opened).toBe('Abierto')
    expect(CONDITION_LABELS.started).toBe('Empezado')
    expect(DECALS_LABELS.perfect).toBe('Perfectas')
    expect(STATUS_LABELS.reserved).toBe('Reservado')
    expect(Object.keys(CONDITION_LABELS)).toHaveLength(3)
    expect(Object.keys(DECALS_LABELS)).toHaveLength(3)
    expect(Object.keys(STATUS_LABELS)).toHaveLength(5)
  })
})

describe('pendingVisibilityLabel', () => {
  const now = Date.parse('2026-11-10T12:00:00Z')
  it('null si ya es visible', () => {
    expect(pendingVisibilityLabel('2026-11-10T11:59:59Z', now)).toBeNull()
    expect(pendingVisibilityLabel('2026-11-10T12:00:00Z', now)).toBeNull()
  })
  it('horas redondeadas hacia arriba, o minutos en la última hora', () => {
    expect(pendingVisibilityLabel('2026-11-11T12:00:00Z', now)).toBe('Público en 24 h')
    expect(pendingVisibilityLabel('2026-11-10T13:30:00Z', now)).toBe('Público en 2 h')
    expect(pendingVisibilityLabel('2026-11-10T12:20:00Z', now)).toBe('Público en 20 min')
  })
})
