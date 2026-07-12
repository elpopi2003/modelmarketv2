import {
  canPublishListing as canPublish,
  canCreateRequest as canCreate,
  DEFAULT_TIER,
  getCapabilities,
  type SubscriptionTier,
} from '@/lib/subscription'
import { useSubscription } from '@/hooks/useSubscription'

/**
 * Límites y capacidades del plan del usuario, leídos de su suscripción real.
 * Mientras carga o sin sesión, cae a `DEFAULT_TIER` (free).
 */
export function useSubscriptionLimits() {
  const { data } = useSubscription()
  const tier: SubscriptionTier = data ?? DEFAULT_TIER
  const capabilities = getCapabilities(tier)

  return {
    tier,
    capabilities,
    maxPhotosPerItem: capabilities.maxPhotosPerItem,
    canPublishListing: (currentCount: number) => canPublish(tier, currentCount),
    canCreateRequest: (currentCount: number) => canCreate(tier, currentCount),
  }
}
