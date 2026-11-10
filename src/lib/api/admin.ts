import type { Listing } from '@/lib/api/listings'
import type { Request } from '@/lib/api/requests'
import type { SubscriptionPlan } from '@/integrations/supabase/types'
import { AppError } from '@/lib/errors'
import { api } from './http'

export interface AdminUser {
  id: string
  email: string
  display_name: string | null
  username: string | null
  location: string | null
  avatar_url: string | null
  is_admin: boolean
  tier: SubscriptionPlan
  listings_count: number
  requests_count: number
  reports_count: number
  created_at: string
  /** Fecha de suspensión, o null si la cuenta está activa. */
  suspended_at: string | null
  /** Motivo que se le comunicó por email. Solo lo ven admins y el propio usuario. */
  suspension_reason: string | null
}

/** Usuarios con email y actividad. El servidor comprueba el rol. */
export const fetchAdminUsers = () => api<AdminUser[]>('/admin/users')

/** Promueve o degrada a administrador (nadie se degrada a sí mismo y siempre queda uno). */
export async function setUserAdmin(userId: string, makeAdmin: boolean): Promise<void> {
  await api(`/admin/users/${userId}/admin`, { method: 'PUT', body: { makeAdmin } })
}

/** Elimina la cuenta de otro usuario (con email de aviso). */
export async function deleteUserAsAdmin(userId: string): Promise<void> {
  await api(`/admin/users/${userId}`, { method: 'DELETE' })
}

export interface ModerationResult {
  /** El email sale por la cola de envío; si fallara, se reintenta solo. */
  emailSent: boolean
  emailError: string | null
}

/**
 * Suspende una cuenta: la saca de sus sesiones, oculta su contenido y le envía el motivo
 * por email. El motivo es obligatorio.
 */
export function suspendUser(userId: string, reason: string): Promise<ModerationResult> {
  return api<ModerationResult>(`/admin/users/${userId}/suspend`, { body: { reason } })
}

/** Levanta la suspensión: devuelve el acceso y vuelve a mostrar su contenido. */
export function unsuspendUser(userId: string): Promise<ModerationResult> {
  return api<ModerationResult>(`/admin/users/${userId}/unsuspend`, { method: 'POST', body: {} })
}

/**
 * Cambio de plan desde administración. Actúa sobre Stripe, así que llega con la fase de
 * pagos de v3; hasta entonces el panel lo tiene desactivado.
 */
export async function setUserTier(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _userId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tier: SubscriptionPlan,
): Promise<ModerationResult & { stripeAction: string }> {
  throw new AppError('El cambio de plan estará disponible cuando se integren los pagos.', {
    code: 'payments_pending',
  })
}

/** Todo el contenido, en cualquier estado, para moderar. */
export const fetchAllListings = () => api<Listing[]>('/admin/listings')
export const fetchAllRequests = () => api<Request[]>('/admin/requests')

export type ContentKind = 'listing' | 'request'

/** Retira contenido guardando su estado previo, para poder devolverlo tal cual. */
export async function takeDownContent(kind: ContentKind, id: string): Promise<void> {
  await api(`/admin/content/${kind}/${id}/take-down`, { method: 'POST', body: {} })
}

/** Restaura contenido a su estado previo. */
export async function restoreContent(kind: ContentKind, id: string): Promise<void> {
  await api(`/admin/content/${kind}/${id}/restore`, { method: 'POST', body: {} })
}
