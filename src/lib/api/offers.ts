import { supabase } from '@/integrations/supabase/client'
import { handleSupabaseError } from '@/lib/errors'
import type { Database, OfferStatus } from '@/integrations/supabase/types'

export type Offer = Database['public']['Tables']['offers']['Row']

export interface CreateOfferInput {
  /** Indica uno de los dos, nunca ambos. */
  listingId?: string
  requestId?: string
  amountCents: number
  message?: string
}

/**
 * Crea (o revisa) una oferta. La RPC abre/reutiliza la conversación, deja el mensaje
 * y aplica el gate PRO/Retail de las peticiones server-side.
 * Devuelve el id de la conversación para navegar al hilo.
 */
export async function createOffer({
  listingId,
  requestId,
  amountCents,
  message,
}: CreateOfferInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_offer', {
    _listing_id: listingId ?? null,
    _request_id: requestId ?? null,
    _amount_cents: amountCents,
    _message: message ?? null,
  })
  if (error) handleSupabaseError(error)
  return data as string
}

/** Aceptar/rechazar (destinatario) o retirar (emisor). */
export async function respondToOffer(offerId: string, status: OfferStatus): Promise<void> {
  const { error } = await supabase.rpc('respond_to_offer', {
    _offer_id: offerId,
    _status: status,
  })
  if (error) handleSupabaseError(error)
}

/** Contador público de ofertas de una petición. */
export async function fetchRequestOfferCount(requestId: string): Promise<number> {
  const { data, error } = await supabase.rpc('request_offer_count', { _request_id: requestId })
  if (error) handleSupabaseError(error)
  return data ?? 0
}

/** Ofertas recibidas o enviadas por el usuario actual (la RLS filtra). */
export async function fetchOffersForRequest(requestId: string): Promise<Offer[]> {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false })
  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function fetchOffersForListing(listingId: string): Promise<Offer[]> {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
  if (error) handleSupabaseError(error)
  return data ?? []
}
