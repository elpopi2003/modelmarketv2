import { describe, expect, it } from 'vitest'
import {
  canCreateRequest,
  canPublishListing,
  compareTiers,
  DEFAULT_TIER,
  getCapabilities,
  isAtLeast,
  isSubscriptionTier,
  isUnlimited,
  normalizeTier,
  remaining,
  remainingPhotos,
  SUBSCRIPTION_TIERS,
  UNLIMITED,
} from './subscription'

describe('isSubscriptionTier', () => {
  it('acepta los tiers válidos', () => {
    for (const tier of SUBSCRIPTION_TIERS) {
      expect(isSubscriptionTier(tier)).toBe(true)
    }
  })

  it('rechaza valores inválidos', () => {
    expect(isSubscriptionTier('premium')).toBe(false)
    expect(isSubscriptionTier(null)).toBe(false)
    expect(isSubscriptionTier(1)).toBe(false)
    expect(isSubscriptionTier(undefined)).toBe(false)
  })
})

describe('normalizeTier', () => {
  it('conserva tiers válidos y cae a free si no lo son', () => {
    expect(normalizeTier('pro')).toBe('pro')
    expect(normalizeTier('desconocido')).toBe(DEFAULT_TIER)
    expect(normalizeTier(null)).toBe('free')
  })
})

describe('límites por tier', () => {
  it('free permite 1 anuncio y 1 petición', () => {
    expect(canPublishListing('free', 0)).toBe(true)
    expect(canPublishListing('free', 1)).toBe(false)
    expect(canCreateRequest('free', 0)).toBe(true)
    expect(canCreateRequest('free', 1)).toBe(false)
  })

  it('pro y retail son ilimitados en anuncios/peticiones', () => {
    expect(canPublishListing('pro', 999)).toBe(true)
    expect(canCreateRequest('retail', 100000)).toBe(true)
    expect(isUnlimited(getCapabilities('pro').maxListings)).toBe(true)
  })

  it('fotos: free 2, pro 5, retail ilimitado', () => {
    expect(remainingPhotos('free', 0)).toBe(2)
    expect(remainingPhotos('free', 2)).toBe(0)
    expect(remainingPhotos('pro', 3)).toBe(2)
    expect(isUnlimited(remainingPhotos('retail', 50))).toBe(true)
  })
})

describe('remaining', () => {
  it('nunca es negativo', () => {
    expect(remaining(2, 5)).toBe(0)
  })

  it('devuelve UNLIMITED para límites infinitos', () => {
    expect(remaining(UNLIMITED, 10)).toBe(UNLIMITED)
    expect(isUnlimited(remaining(UNLIMITED, 10))).toBe(true)
  })
})

describe('jerarquía de tiers', () => {
  it('ordena free < pro < retail por prioridad', () => {
    expect(compareTiers('free', 'pro')).toBeLessThan(0)
    expect(compareTiers('retail', 'pro')).toBeGreaterThan(0)
    expect(compareTiers('pro', 'pro')).toBe(0)
  })

  it('isAtLeast respeta el nivel mínimo', () => {
    expect(isAtLeast('retail', 'pro')).toBe(true)
    expect(isAtLeast('pro', 'pro')).toBe(true)
    expect(isAtLeast('free', 'pro')).toBe(false)
  })
})

describe('capacidades específicas', () => {
  it('solo retail tiene importación CSV', () => {
    expect(getCapabilities('free').csvBulkImport).toBe(false)
    expect(getCapabilities('pro').csvBulkImport).toBe(false)
    expect(getCapabilities('retail').csvBulkImport).toBe(true)
  })

  it('free tiene visibilidad retardada 24h; pro/retail inmediata', () => {
    expect(getCapabilities('free').immediateVisibility).toBe(false)
    expect(getCapabilities('free').visibilityDelayHours).toBe(24)
    expect(getCapabilities('pro').immediateVisibility).toBe(true)
    expect(getCapabilities('retail').visibilityDelayHours).toBe(0)
  })

  it('responder a peticiones es solo de pago (las peticiones se leen gratis)', () => {
    expect(getCapabilities('free').canRespondToRequests).toBe(false)
    expect(getCapabilities('pro').canRespondToRequests).toBe(true)
    expect(getCapabilities('retail').canRespondToRequests).toBe(true)
  })
})
