/**
 * Modelo de suscripciones tipado — fuente de verdad de límites y capacidades.
 *
 * Sustituye por completo a cualquier `isPro: boolean`. Los niveles coinciden con el enum
 * de base de datos `subscription_plan`. Toda la lógica de "¿qué puede hacer este tier?"
 * vive aquí, no dispersa por hooks/UI/Edge Functions.
 */

export const SUBSCRIPTION_TIERS = ['free', 'pro', 'retail'] as const

export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number]

export const DEFAULT_TIER: SubscriptionTier = 'free'

/** Límite "sin tope". Usar `isUnlimited()` para comprobarlo, no comparar con Infinity a mano. */
export const UNLIMITED = Number.POSITIVE_INFINITY

export interface TierCapabilities {
  /** Etiqueta para UI. */
  label: string
  /** Precio mensual en euros (0 = gratis). */
  priceMonthly: number
  /** Máximo de anuncios activos. `UNLIMITED` = ilimitado. */
  maxListings: number
  /** Máximo de peticiones activas. `UNLIMITED` = ilimitado. */
  maxRequests: number
  /** Máximo de fotos por anuncio/petición. `UNLIMITED` = ilimitado. */
  maxPhotosPerItem: number
  /** Si el contenido se publica de inmediato (true) o con retardo (false). */
  immediateVisibility: boolean
  /** Horas de retardo de visibilidad para el plan (0 si es inmediata). */
  visibilityDelayHours: number
  /** Muestra insignia de plan. */
  hasBadge: boolean
  /**
   * Puede responder a peticiones (enviar ofertas a su autor).
   * Las peticiones son públicas para todos; solo el contacto está reservado a PRO/Retail.
   */
  canRespondToRequests: boolean
  /** Prioridad en listados/orden (mayor = más prioridad). free < pro < retail. */
  priority: number
}

export const TIER_CAPABILITIES: Record<SubscriptionTier, TierCapabilities> = {
  free: {
    label: 'Free',
    priceMonthly: 0,
    maxListings: 1,
    maxRequests: 1,
    maxPhotosPerItem: 2,
    immediateVisibility: false,
    visibilityDelayHours: 24,
    hasBadge: false,
    canRespondToRequests: false,
    priority: 0,
  },
  pro: {
    label: 'PRO',
    priceMonthly: 4.99,
    maxListings: UNLIMITED,
    maxRequests: UNLIMITED,
    maxPhotosPerItem: 5,
    immediateVisibility: true,
    visibilityDelayHours: 0,
    hasBadge: true,
    canRespondToRequests: true,
    priority: 1,
  },
  retail: {
    label: 'Retail',
    priceMonthly: 19.99,
    maxListings: UNLIMITED,
    maxRequests: UNLIMITED,
    maxPhotosPerItem: UNLIMITED,
    immediateVisibility: true,
    visibilityDelayHours: 0,
    hasBadge: true,
    canRespondToRequests: true,
    priority: 2,
  },
}

/** Type guard: comprueba que un string desconocido es un tier válido. */
export function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  return typeof value === 'string' && (SUBSCRIPTION_TIERS as readonly string[]).includes(value)
}

/** Normaliza cualquier valor a un tier válido, cayendo a `free` si no lo es. */
export function normalizeTier(value: unknown): SubscriptionTier {
  return isSubscriptionTier(value) ? value : DEFAULT_TIER
}

/** Capacidades de un tier. */
export function getCapabilities(tier: SubscriptionTier): TierCapabilities {
  return TIER_CAPABILITIES[tier]
}

export function isUnlimited(limit: number): boolean {
  return !Number.isFinite(limit)
}

/**
 * Unidades restantes de un límite dado el uso actual.
 * Devuelve `UNLIMITED` si el límite es ilimitado, y nunca baja de 0.
 */
export function remaining(limit: number, used: number): number {
  if (isUnlimited(limit)) return UNLIMITED
  return Math.max(0, limit - used)
}

export function canPublishListing(tier: SubscriptionTier, currentCount: number): boolean {
  return remaining(getCapabilities(tier).maxListings, currentCount) > 0
}

export function canCreateRequest(tier: SubscriptionTier, currentCount: number): boolean {
  return remaining(getCapabilities(tier).maxRequests, currentCount) > 0
}

/** ¿Cuántas fotos más puede subir a un item con `currentPhotos` fotos ya? */
export function remainingPhotos(tier: SubscriptionTier, currentPhotos: number): number {
  return remaining(getCapabilities(tier).maxPhotosPerItem, currentPhotos)
}

/** Compara dos tiers por prioridad. <0 si a<b, 0 si igual, >0 si a>b. */
export function compareTiers(a: SubscriptionTier, b: SubscriptionTier): number {
  return getCapabilities(a).priority - getCapabilities(b).priority
}

/** ¿El tier cumple al menos el nivel `minimum`? (p. ej. gate de features de pago). */
export function isAtLeast(tier: SubscriptionTier, minimum: SubscriptionTier): boolean {
  return compareTiers(tier, minimum) >= 0
}
