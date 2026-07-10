import {
  canPublishListing as canPublish,
  canCreateRequest as canCreate,
  DEFAULT_TIER,
  getCapabilities,
  type SubscriptionTier,
} from '@/lib/subscription'

/**
 * Límites y capacidades del plan del usuario.
 *
 * TODO (M5): leer el `tier` real de la suscripción (tabla `subscriptions`) en lugar de
 * asumir `DEFAULT_TIER`. La interfaz ya queda estable para ese cambio.
 */
export function useSubscriptionLimits() {
  const tier: SubscriptionTier = DEFAULT_TIER
  const capabilities = getCapabilities(tier)

  return {
    tier,
    capabilities,
    maxPhotosPerItem: capabilities.maxPhotosPerItem,
    canPublishListing: (currentCount: number) => canPublish(tier, currentCount),
    canCreateRequest: (currentCount: number) => canCreate(tier, currentCount),
  }
}
