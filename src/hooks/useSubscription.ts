import { useMutation, useQuery } from '@tanstack/react-query'
import {
  createCheckout,
  fetchMySubscriptionTier,
  fetchPublicTiers,
  openCustomerPortal,
} from '@/lib/api/subscriptions'
import { queryKeys } from '@/lib/queryKeys'
import { useAuth } from '@/hooks/useAuth'
import { DEFAULT_TIER, type SubscriptionTier } from '@/lib/subscription'

/** Tier real del usuario (defecto free mientras carga o sin sesión). */
export function useSubscription() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.subscription.current(),
    queryFn: fetchMySubscriptionTier,
    enabled: Boolean(user),
  })
}

/** Tiers públicos (pro/retail) de un conjunto de usuarios, para insignias. */
export function usePublicTiers(userIds: string[]) {
  const unique = [...new Set(userIds)].sort()
  return useQuery({
    queryKey: [...queryKeys.subscription.all, 'public-tiers', unique.join(',')],
    queryFn: () => fetchPublicTiers(unique),
    enabled: unique.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCheckout() {
  return useMutation({
    mutationFn: (tier: SubscriptionTier) => createCheckout(tier),
    onSuccess: (url) => {
      window.location.href = url
    },
  })
}

export function useCustomerPortal() {
  return useMutation({
    mutationFn: openCustomerPortal,
    onSuccess: (url) => {
      window.location.href = url
    },
  })
}

export { DEFAULT_TIER }
