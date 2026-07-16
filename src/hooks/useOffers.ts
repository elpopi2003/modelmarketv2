import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createOffer,
  fetchOffersForListing,
  fetchOffersForRequest,
  fetchRequestOfferCount,
  respondToOffer,
  type CreateOfferInput,
} from '@/lib/api/offers'
import { queryKeys } from '@/lib/queryKeys'
import type { OfferStatus } from '@/integrations/supabase/types'

/** Contador público de ofertas de una petición ("N ofertas"). */
export function useRequestOfferCount(requestId: string) {
  return useQuery({
    queryKey: queryKeys.offers.requestCount(requestId),
    queryFn: () => fetchRequestOfferCount(requestId),
    enabled: Boolean(requestId),
  })
}

/** Ofertas visibles de una petición (la RLS solo deja ver las propias/recibidas). */
export function useRequestOffers(requestId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.offers.forRequest(requestId ?? ''),
    queryFn: () => fetchOffersForRequest(requestId!),
    enabled: Boolean(requestId),
  })
}

export function useListingOffers(listingId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.offers.forListing(listingId ?? ''),
    queryFn: () => fetchOffersForListing(listingId!),
    enabled: Boolean(listingId),
  })
}

/** Envía una oferta. Devuelve el id de la conversación abierta. */
export function useCreateOffer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOfferInput) => createOffer(input),
    onSuccess: (_conversationId, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.offers.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
      if (input.requestId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.offers.requestCount(input.requestId),
        })
      }
    },
  })
}

/** Aceptar/rechazar/retirar una oferta. */
export function useRespondToOffer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ offerId, status }: { offerId: string; status: OfferStatus }) =>
      respondToOffer(offerId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.offers.all })
      // Aceptar una oferta reserva el anuncio.
      void queryClient.invalidateQueries({ queryKey: queryKeys.listings.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}
