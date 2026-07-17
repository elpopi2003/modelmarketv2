import { describe, expect, it } from 'vitest'
import { requestSchema } from './request'

const base = {
  title: 'Busco Tamiya Tiger I',
  description: 'Precintado a ser posible, pago bien.',
  maxPriceEuros: 60,
  scale: '1:35',
  categoryId: '00000000-0000-0000-0000-000000000001',
  brandId: '00000000-0000-0000-0000-000000000002',
  acceptedConditions: ['sealed', 'opened'] as const,
  decalsRequirement: 'any' as const,
  urgency: 'normal' as const,
}

describe('requestSchema', () => {
  it('acepta una petición completa', () => {
    expect(requestSchema.safeParse(base).success).toBe(true)
  })

  it('exige al menos un estado aceptado', () => {
    expect(requestSchema.safeParse({ ...base, acceptedConditions: [] }).success).toBe(false)
  })

  it('rechaza estados fuera de la taxonomía', () => {
    expect(requestSchema.safeParse({ ...base, acceptedConditions: ['new'] }).success).toBe(false)
  })

  it('rechaza requisito de calcas o urgencia inválidos', () => {
    expect(requestSchema.safeParse({ ...base, decalsRequirement: 'rotas' }).success).toBe(false)
    expect(requestSchema.safeParse({ ...base, urgency: 'ya' }).success).toBe(false)
  })
})
