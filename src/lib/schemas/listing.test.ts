import { describe, expect, it } from 'vitest'
import { listingSchema } from './listing'

const base = {
  title: 'Tanque Tiger I',
  description: 'Kit precintado, sin abrir, en perfecto estado.',
  priceEuros: 25,
  condition: 'sealed' as const,
  decals: 'perfect' as const,
  shippingInpost: true,
  handDelivery: false,
  acceptsOffers: true,
  scale: '1:35',
  categoryId: '00000000-0000-0000-0000-000000000001',
  brandId: '00000000-0000-0000-0000-000000000002',
}

describe('listingSchema', () => {
  it('acepta un anuncio con todos los campos', () => {
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

  it('exige todos los campos obligatorios', () => {
    expect(listingSchema.safeParse({ ...base, description: '' }).success).toBe(false)
    expect(listingSchema.safeParse({ ...base, priceEuros: '' }).success).toBe(false)
    expect(listingSchema.safeParse({ ...base, scale: '' }).success).toBe(false)
    expect(listingSchema.safeParse({ ...base, categoryId: '' }).success).toBe(false)
    expect(listingSchema.safeParse({ ...base, brandId: '' }).success).toBe(false)
  })

  it('con escala "other" exige la escala escrita a mano', () => {
    // "other" sin customScale no vale: el desplegable no guarda "other" como escala.
    expect(listingSchema.safeParse({ ...base, scale: 'other' }).success).toBe(false)
    expect(listingSchema.safeParse({ ...base, scale: 'other', customScale: '' }).success).toBe(false)
    expect(listingSchema.safeParse({ ...base, scale: 'other', customScale: '1:9' }).success).toBe(true)
  })

  it('exige al menos un método de entrega', () => {
    expect(
      listingSchema.safeParse({ ...base, shippingInpost: false, handDelivery: false }).success,
    ).toBe(false)
    expect(
      listingSchema.safeParse({ ...base, shippingInpost: false, handDelivery: true }).success,
    ).toBe(true)
  })

  it('acepta ambos valores de acceptsOffers', () => {
    expect(listingSchema.safeParse({ ...base, acceptsOffers: false }).success).toBe(true)
    expect(listingSchema.safeParse({ ...base, acceptsOffers: true }).success).toBe(true)
  })

  it('exige acceptsOffers explícito', () => {
    const sinCampo: Record<string, unknown> = { ...base }
    delete sinCampo.acceptsOffers
    expect(listingSchema.safeParse(sinCampo).success).toBe(false)
  })

  it('rechaza un estado de calcas inválido', () => {
    expect(listingSchema.safeParse({ ...base, decals: 'rotas' }).success).toBe(false)
  })

  it('con marca "Otra" exige el nombre de la nueva marca', () => {
    expect(listingSchema.safeParse({ ...base, brandId: 'other' }).success).toBe(false)
    expect(listingSchema.safeParse({ ...base, brandId: 'other', newBrand: 'A' }).success).toBe(false)
    expect(listingSchema.safeParse({ ...base, brandId: 'other', newBrand: 'Meng' }).success).toBe(
      true,
    )
  })
})
