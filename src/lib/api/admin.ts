import { supabase } from '@/integrations/supabase/client'
import { handleSupabaseError } from '@/lib/errors'
import type { Listing } from '@/lib/api/listings'
import type { Request } from '@/lib/api/requests'
import type { SubscriptionPlan } from '@/integrations/supabase/types'

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

/** Usuarios con email y actividad. La RPC comprueba el rol en la BD. */
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_users')
  if (error) handleSupabaseError(error)
  return (data ?? []) as AdminUser[]
}

/** Promueve o degrada a administrador (la BD impide auto-degradarse y quedarse sin admins). */
export async function setUserAdmin(userId: string, makeAdmin: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_admin', {
    _user_id: userId,
    _make_admin: makeAdmin,
  })
  if (error) handleSupabaseError(error)
}

/** Elimina la cuenta de otro usuario vía Edge Function (rol verificado server-side). */
export async function deleteUserAsAdmin(userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-delete-user', {
    body: { userId },
  })
  if (error) throw error
  if (data && data.ok === false) throw new Error(data.error ?? 'No se pudo eliminar el usuario')
}

export interface ModerationResult {
  /** El email pudo fallar sin que la acción se deshaga: hay que poder avisarlo. */
  emailSent: boolean
  emailError: string | null
}

/**
 * Suspende una cuenta: bloquea el acceso y oculta su contenido. El motivo es obligatorio
 * porque se le envía a la persona por email.
 */
export async function suspendUser(userId: string, reason: string): Promise<ModerationResult> {
  const { data, error } = await supabase.functions.invoke('admin-suspend-user', {
    body: { userId, action: 'suspend', reason },
  })
  if (error) throw error
  if (data && data.ok === false) throw new Error(data.error ?? 'No se pudo suspender la cuenta')
  return { emailSent: Boolean(data?.data?.emailSent), emailError: data?.data?.emailError ?? null }
}

/** Levanta la suspensión: devuelve el acceso y vuelve a mostrar su contenido. */
export async function unsuspendUser(userId: string): Promise<ModerationResult> {
  const { data, error } = await supabase.functions.invoke('admin-suspend-user', {
    body: { userId, action: 'unsuspend' },
  })
  if (error) throw error
  if (data && data.ok === false) throw new Error(data.error ?? 'No se pudo reactivar la cuenta')
  return { emailSent: Boolean(data?.data?.emailSent), emailError: data?.data?.emailError ?? null }
}

/**
 * Cambia el plan de un usuario. Actúa también sobre Stripe (cancela o cambia el precio):
 * escribir solo en la base duraría hasta el siguiente evento del webhook.
 */
export async function setUserTier(
  userId: string,
  tier: SubscriptionPlan,
): Promise<ModerationResult & { stripeAction: string }> {
  const { data, error } = await supabase.functions.invoke('admin-set-tier', {
    body: { userId, tier },
  })
  if (error) throw error
  if (data && data.ok === false) throw new Error(data.error ?? 'No se pudo cambiar el plan')
  return {
    emailSent: Boolean(data?.data?.emailSent),
    emailError: data?.data?.emailError ?? null,
    stripeAction: data?.data?.stripeAction ?? 'none',
  }
}

/**
 * Todo el contenido, sin filtrar por estado: la policy de admin permite verlo entero.
 * Para un no-admin la RLS devolvería solo lo suyo y lo público.
 */
export async function fetchAllListings(): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function fetchAllRequests(): Promise<Request[]> {
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) handleSupabaseError(error)
  return data ?? []
}

export type ContentKind = 'listing' | 'request'

/**
 * Retira contenido guardando su estado previo, para poder devolverlo tal cual.
 * Vía RPC: leer-y-escribir desde el cliente podría guardar un estado obsoleto.
 */
export async function takeDownContent(kind: ContentKind, id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_take_down', { _kind: kind, _id: id })
  if (error) handleSupabaseError(error)
}

/** Restaura contenido a su estado previo (o al público por defecto si no consta). */
export async function restoreContent(kind: ContentKind, id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_restore', { _kind: kind, _id: id })
  if (error) handleSupabaseError(error)
}
