import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createListing,
  deleteListing,
  fetchListingById,
  fetchListings,
  fetchMyListings,
  updateListing,
  type ListingFilters,
  type ListingInsert,
  type ListingUpdate,
} from '@/lib/api/listings'
import { queryKeys } from '@/lib/queryKeys'
import { useAuth } from '@/hooks/useAuth'

export function useListings(filters: ListingFilters = {}) {
  return useQuery({
    queryKey: queryKeys.listings.list(filters),
    queryFn: () => fetchListings(filters),
  })
}

export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.listings.detail(id) : queryKeys.listings.all,
    queryFn: () => fetchListingById(id as string),
    enabled: Boolean(id),
  })
}

export function useMyListings() {
  const { user } = useAuth()
  const userId = user?.id
  return useQuery({
    queryKey: userId ? queryKeys.listings.mine(userId) : queryKeys.listings.all,
    queryFn: () => fetchMyListings(userId as string),
    enabled: Boolean(userId),
  })
}

export function useCreateListing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ListingInsert) => createListing(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.listings.all })
    },
  })
}

export function useUpdateListing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: ListingUpdate }) =>
      updateListing(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.listings.all })
      queryClient.setQueryData(queryKeys.listings.detail(data.id), data)
    },
  })
}

export function useDeleteListing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteListing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.listings.all })
    },
  })
}
