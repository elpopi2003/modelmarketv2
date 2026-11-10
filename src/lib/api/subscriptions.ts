import { supabase } from '@/integrations/supabase/client'
import { normalizeTier, type SubscriptionTier } from '@/lib/subscription'
import { api } from './http'

/** Planes públicos (PRO/Retail activos) de varios usuarios, para las insignias. */
export async function fetchPublicTiers(
  userIds: string[],
): Promise<Record<string, SubscriptionTier>> {
  if (userIds.length === 0) return {}
  const map: Record<string, SubscriptionTier> = {}
  for (let i = 0; i < userIds.length; i += 100) {
    const ids = userIds.slice(i, i + 100).join(',')
    Object.assign(
      map,
      await api<Record<string, SubscriptionTier>>(`/subscription/public-tiers?ids=${ids}`),
    )
  }
  for (const [id, tier] of Object.entries(map)) map[id] = normalizeTier(tier)
  return map
}

/** Plan efectivo del usuario ('free' si no tiene una suscripción activa). */
export async function fetchMySubscriptionTier(): Promise<SubscriptionTier> {
  const { tier } = await api<{ tier: string }>('/subscription')
  return normalizeTier(tier)
}

function extractUrl(payload: unknown): string {
  const p = payload as { url?: string; data?: { url?: string } } | null
  const url = p?.data?.url ?? p?.url
  if (!url) throw new Error('Respuesta sin URL')
  return url
}

/** Inicia un Checkout de Stripe para el tier dado; devuelve la URL a la que redirigir. */
export async function createCheckout(tier: SubscriptionTier): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-checkout', { body: { tier } })
  if (error) throw new Error(error.message)
  return extractUrl(data)
}

/** Abre el portal de facturación de Stripe; devuelve la URL. */
export async function openCustomerPortal(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('customer-portal', { body: {} })
  if (error) throw new Error(error.message)
  return extractUrl(data)
}
