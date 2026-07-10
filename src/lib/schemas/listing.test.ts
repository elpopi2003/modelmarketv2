import { describe, expect, it } from 'vitest'
import { listingSchema } from './listing'

const base = { title: 'Tanque Tiger I', priceEuros: 25, condition: 'used' as const }

describe('listingSchema', () => {
  it('acepta un anuncio válido mínimo', () => {
    expect(listingSchema.safeParse(base).success).toBe(true)
  })

  it('rechaza título demasiado corto', () => {
    expect(listingSchema.safeParse({ ...base, title: 'ab' }).success).toBe(false)
  })

  it('rechaza precio negativo', () => {
    expect(listingSchema.safeParse({ ...base, priceEuros: -1 }).success).toBe(false)
  })

  it('rechaza estado inválido', () => {
    expect(listingSchema.safeParse({ ...base, condition: 'roto' }).success).toBe(false)
  })

  it('coacciona el precio desde string', () => {
    const result = listingSchema.safeParse({ ...base, priceEuros: '49.99' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.priceEuros).toBeCloseTo(49.99)
  })
})
