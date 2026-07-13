import { supabase } from '@/integrations/supabase/client'
import { handleSupabaseError } from '@/lib/errors'
import { normalizeTier, type SubscriptionTier } from '@/lib/subscription'

/** Tier público (activo) de varios usuarios, para insignias. Solo pro/retail. */
export async function fetchPublicTiers(
  userIds: string[],
): Promise<Record<string, SubscriptionTier>> {
  if (userIds.length === 0) return {}
  const { data, error } = await supabase
    .from('subscriptions_public')
    .select('user_id, tier, status')
    .in('user_id', userIds)
  if (error) handleSupabaseError(error)

  const map: Record<string, SubscriptionTier> = {}
  for (const row of data ?? []) {
    const active = row.status === 'active' || row.status === 'trialing'
    if (row.user_id && active) map[row.user_id] = normalizeTier(row.tier)
  }
  return map
}

/** Tier real del usuario (lee su suscripción; 'free' si no hay o no está activa). */
export async function fetchMySubscriptionTier(): Promise<SubscriptionTier> {
  const { data, error } = await supabase.from('subscriptions').select('tier, status').maybeSingle()
  if (error) handleSupabaseError(error)
  if (!data) return 'free'
  const active = data.status === 'active' || data.status === 'trialing'
  return active ? normalizeTier(data.tier) : 'free'
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
