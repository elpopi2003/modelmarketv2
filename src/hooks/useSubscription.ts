import { useMutation, useQuery } from '@tanstack/react-query'
import {
  createCheckout,
  fetchMySubscriptionTier,
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
