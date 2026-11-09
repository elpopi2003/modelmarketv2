import { supabase } from '@/integrations/supabase/client'
import { handleSupabaseError } from '@/lib/errors'
import type { Listing } from '@/lib/api/listings'

/** IDs de los anuncios que el usuario tiene en favoritos (RLS: solo los suyos). */
export async function fetchMyFavoriteListingIds(): Promise<string[]> {
  const { data, error } = await supabase.from('favorites').select('listing_id')
  if (error) handleSupabaseError(error)
  return (data ?? []).map((row) => row.listing_id)
}

/** Anuncios favoritos del usuario, resueltos. */
export async function fetchMyFavoriteListings(): Promise<Listing[]> {
  const ids = await fetchMyFavoriteListingIds()
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .in('id', ids)
    .order('created_at', { ascending: false })
  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function addFavorite(listingId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('favorites')
    .insert({ user_id: userId, listing_id: listingId })
  if (error) handleSupabaseError(error)
}

export async function removeFavorite(listingId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('listing_id', listingId)
  if (error) handleSupabaseError(error)
}

/** Contador público de favoritos (RPC SECURITY DEFINER; no expone quién marcó qué). */
export async function fetchFavoriteCount(listingId: string): Promise<number> {
  const { data, error } = await supabase.rpc('listing_favorite_count', { _listing_id: listingId })
  if (error) handleSupabaseError(error)
  return data ?? 0
}
