import type { Listing } from '@/lib/api/listings'
import { api } from './http'

/** IDs de los anuncios que el usuario tiene en favoritos. */
export const fetchMyFavoriteListingIds = () => api<string[]>('/favorites/ids')

/** Anuncios favoritos del usuario que sigue pudiendo ver. */
export const fetchMyFavoriteListings = () => api<Listing[]>('/favorites/listings')

export async function addFavorite(listingId: string): Promise<void> {
  await api(`/favorites/${listingId}`, { method: 'PUT', body: {} })
}

export async function removeFavorite(listingId: string): Promise<void> {
  await api(`/favorites/${listingId}`, { method: 'DELETE' })
}

/** Contador público de favoritos (cuántos, nunca quiénes). */
export async function fetchFavoriteCount(listingId: string): Promise<number> {
  const { count } = await api<{ count: number }>(`/listings/${listingId}/favorite-count`)
  return count
}
