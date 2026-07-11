import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addFavorite,
  fetchFavoriteCount,
  fetchMyFavoriteListingIds,
  fetchMyFavoriteListings,
  removeFavorite,
} from '@/lib/api/favorites'
import { queryKeys } from '@/lib/queryKeys'
import { useAuth } from '@/hooks/useAuth'

export function useMyFavoriteIds() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.favorites.list(user?.id ?? 'anon'),
    queryFn: fetchMyFavoriteListingIds,
    enabled: Boolean(user),
  })
}

export function useMyFavoriteListings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...queryKeys.favorites.list(user?.id ?? 'anon'), 'listings'],
    queryFn: fetchMyFavoriteListings,
    enabled: Boolean(user),
  })
}

export function useFavoriteCount(listingId: string) {
  return useQuery({
    queryKey: [...queryKeys.favorites.all, 'count', listingId],
    queryFn: () => fetchFavoriteCount(listingId),
  })
}

export function useToggleFavorite() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ listingId, isFavorited }: { listingId: string; isFavorited: boolean }) => {
      if (!user) throw new Error('Debes iniciar sesión')
      if (isFavorited) await removeFavorite(listingId, user.id)
      else await addFavorite(listingId, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all })
    },
  })
}
