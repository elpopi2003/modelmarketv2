import { supabase } from '@/integrations/supabase/client'
import { handleSupabaseError } from '@/lib/errors'
import type { Database } from '@/integrations/supabase/types'

export type Request = Database['public']['Tables']['requests']['Row']
export type RequestInsert = Database['public']['Tables']['requests']['Insert']
export type RequestUpdate = Database['public']['Tables']['requests']['Update']

export type RequestSort = 'recent' | 'budget_desc' | 'budget_asc'

export interface RequestFilters {
  categoryId?: string
  brandId?: string
  search?: string
  sort?: RequestSort
}

/** Peticiones públicas (solo abiertas; la RLS filtra visibilidad y ownership). */
export async function fetchRequests(filters: RequestFilters = {}): Promise<Request[]> {
  let query = supabase.from('requests').select('*').eq('status', 'open')

  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.brandId) query = query.eq('brand_id', filters.brandId)
  if (filters.search) query = query.ilike('title', `%${filters.search}%`)

  const ordered =
    filters.sort === 'budget_desc'
      ? query.order('max_price_cents', { ascending: false, nullsFirst: false })
      : filters.sort === 'budget_asc'
        ? query.order('max_price_cents', { ascending: true, nullsFirst: false })
        : query.order('created_at', { ascending: false })

  const { data, error } = await ordered
  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function fetchRequestById(id: string): Promise<Request | null> {
  const { data, error } = await supabase.from('requests').select('*').eq('id', id).maybeSingle()
  if (error) handleSupabaseError(error)
  return data
}

export async function fetchMyRequests(userId: string): Promise<Request[]> {
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function createRequest(input: RequestInsert): Promise<Request> {
  const { data, error } = await supabase.from('requests').insert(input).select('*').single()
  if (error) handleSupabaseError(error)
  return data as Request
}

export async function updateRequest(id: string, updates: RequestUpdate): Promise<Request> {
  const { data, error } = await supabase
    .from('requests')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  if (error) handleSupabaseError(error)
  return data as Request
}

export async function deleteRequest(id: string): Promise<void> {
  const { error } = await supabase.from('requests').delete().eq('id', id)
  if (error) handleSupabaseError(error)
}
