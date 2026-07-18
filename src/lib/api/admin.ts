import { supabase } from '@/integrations/supabase/client'
import { handleSupabaseError } from '@/lib/errors'
import type { Listing } from '@/lib/api/listings'
import type { Request } from '@/lib/api/requests'
import type { ListingStatus, RequestStatus, SubscriptionPlan } from '@/integrations/supabase/types'

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

export async function setListingStatus(id: string, status: ListingStatus): Promise<void> {
  const { error } = await supabase.from('listings').update({ status }).eq('id', id)
  if (error) handleSupabaseError(error)
}

export async function setRequestStatus(id: string, status: RequestStatus): Promise<void> {
  const { error } = await supabase.from('requests').update({ status }).eq('id', id)
  if (error) handleSupabaseError(error)
}
