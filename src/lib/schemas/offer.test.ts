import { describe, expect, it } from 'vitest'
import { offerSchema } from './offer'

describe('offerSchema', () => {
  it('acepta una oferta con importe y mensaje', () => {
    expect(offerSchema.safeParse({ amountEuros: 40, message: 'La tengo precintada' }).success).toBe(
      true,
    )
  })

  it('el mensaje es opcional', () => {
    expect(offerSchema.safeParse({ amountEuros: 40 }).success).toBe(true)
  })

  it('exige el importe', () => {
    expect(offerSchema.safeParse({ amountEuros: '' }).success).toBe(false)
    expect(offerSchema.safeParse({}).success).toBe(false)
  })

  it('rechaza importes negativos', () => {
    expect(offerSchema.safeParse({ amountEuros: -5 }).success).toBe(false)
  })

  it('coacciona el importe desde string', () => {
    const result = offerSchema.safeParse({ amountEuros: '49.99' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.amountEuros).toBeCloseTo(49.99)
  })
})
