import { getCapabilities, normalizeTier, type SubscriptionTier } from '@/lib/subscription'
import type { Db } from '../db/client'

const ACTIVE_STATUSES = new Set(['active', 'trialing'])

/**
 * Plan efectivo del usuario: el de su suscripción si está activa; si no, Free.
 * La matriz de capacidades es la misma que usa el frontend (`src/lib/subscription.ts`).
 */
export async function getUserTier(db: Db, userId: string): Promise<SubscriptionTier> {
  const row = await db
    .selectFrom('subscriptions')
    .select(['tier', 'status'])
    .where('user_id', '=', userId)
    .executeTakeFirst()
  return row && ACTIVE_STATUSES.has(row.status) ? normalizeTier(row.tier) : 'free'
}

export async function getUserCapabilities(db: Db, userId: string) {
  return getCapabilities(await getUserTier(db, userId))
}

/** Planes públicos (solo PRO/Retail activos) de varios usuarios, para las insignias. */
export async function getPublicTiers(db: Db, userIds: string[]) {
  if (userIds.length === 0) return {}
  const rows = await db
    .selectFrom('subscriptions')
    .select(['user_id', 'tier', 'status'])
    .where('user_id', 'in', userIds)
    .where('tier', '!=', 'free')
    .execute()
  const map: Record<string, SubscriptionTier> = {}
  for (const r of rows) if (ACTIVE_STATUSES.has(r.status)) map[r.user_id] = normalizeTier(r.tier)
  return map
}
