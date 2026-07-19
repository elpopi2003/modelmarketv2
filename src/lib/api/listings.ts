import { supabase } from '@/integrations/supabase/client'
import { handleSupabaseError } from '@/lib/errors'
import type { Database, ListingCondition } from '@/integrations/supabase/types'

export type Listing = Database['public']['Tables']['listings']['Row']
export type ListingInsert = Database['public']['Tables']['listings']['Insert']
export type ListingUpdate = Database['public']['Tables']['listings']['Update']

export type ListingSort = 'recent' | 'price_asc' | 'price_desc'

/**
 * Marca o desmarca el anuncio como reservado. Solo para su dueño (la RLS lo exige).
 * Sirve para avisar de que hay un comprador en firme antes de cerrar la venta.
 */
export async function setListingReserved(listingId: string, reserved: boolean): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .update({ status: reserved ? 'reserved' : 'active' })
    .eq('id', listingId)
  if (error) handleSupabaseError(error)
}

/**
 * Suma una visita al anuncio (RPC SECURITY DEFINER: el visitante no tiene UPDATE).
 * Silencioso a propósito: un contador que falla nunca debe romper la ficha.
 */
export async function incrementListingViews(listingId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_listing_views', { _listing_id: listingId })
  if (error) console.warn('[views] no se pudo registrar la visita', error.message)
}

export interface ListingFilters {
  categoryId?: string
  brandId?: string
  condition?: ListingCondition
  /** Búsqueda por título (ilike). */
  search?: string
  minPriceCents?: number
  maxPriceCents?: number
  sort?: ListingSort
}

/**
 * Anuncios públicos del catálogo. Incluye los reservados: siguen visibles (con su lazo)
 * para indicar que ya hay trato. La RLS filtra además visibilidad y ownership.
 */
export async function fetchListings(filters: ListingFilters = {}): Promise<Listing[]> {
  let query = supabase.from('listings').select('*').in('status', ['active', 'reserved'])

  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.brandId) query = query.eq('brand_id', filters.brandId)
  if (filters.condition) query = query.eq('condition', filters.condition)
  if (filters.search) query = query.ilike('title', `%${filters.search}%`)
  if (typeof filters.minPriceCents === 'number') query = query.gte('price_cents', filters.minPriceCents)
  if (typeof filters.maxPriceCents === 'number') query = query.lte('price_cents', filters.maxPriceCents)

  const ordered =
    filters.sort === 'price_asc'
      ? query.order('price_cents', { ascending: true })
      : filters.sort === 'price_desc'
        ? query.order('price_cents', { ascending: false })
        : query.order('created_at', { ascending: false })

  const { data, error } = await ordered
  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function fetchListingById(id: string): Promise<Listing | null> {
  const { data, error } = await supabase.from('listings').select('*').eq('id', id).maybeSingle()
  if (error) handleSupabaseError(error)
  return data
}

/** Anuncios del usuario (todos los estados; la RLS permite ver los propios). */
export async function fetchMyListings(userId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function createListing(input: ListingInsert): Promise<Listing> {
  const { data, error } = await supabase.from('listings').insert(input).select('*').single()
  if (error) handleSupabaseError(error)
  return data as Listing
}

export async function updateListing(id: string, updates: ListingUpdate): Promise<Listing> {
  const { data, error } = await supabase
    .from('listings')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  if (error) handleSupabaseError(error)
  return data as Listing
}

export async function deleteListing(id: string): Promise<void> {
  const { error } = await supabase.from('listings').delete().eq('id', id)
  if (error) handleSupabaseError(error)
}
