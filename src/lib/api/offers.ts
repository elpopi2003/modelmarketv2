import type { Database, OfferStatus } from '@/integrations/supabase/types'
import { api } from './http'

export type Offer = Database['public']['Tables']['offers']['Row']

export interface CreateOfferInput {
  /** Indica uno de los dos, nunca ambos. */
  listingId?: string
  requestId?: string
  amountCents: number
  message?: string
}

/**
 * Crea (o revisa) una oferta. El servidor abre/reutiliza la conversación, deja el mensaje
 * y aplica el gate PRO/Retail de las peticiones. Devuelve el id de la conversación.
 */
export async function createOffer({
  listingId,
  requestId,
  amountCents,
  message,
}: CreateOfferInput): Promise<string> {
  const { conversationId } = await api<{ conversationId: string }>('/offers', {
    body: {
      listingId: listingId ?? null,
      requestId: requestId ?? null,
      amountCents,
      message: message ?? null,
    },
  })
  return conversationId
}

/** Aceptar/rechazar (destinatario) o retirar (emisor). */
export async function respondToOffer(offerId: string, status: OfferStatus): Promise<void> {
  await api(`/offers/${offerId}`, { method: 'PATCH', body: { status } })
}

/** Contador público de ofertas de una petición. */
export async function fetchRequestOfferCount(requestId: string): Promise<number> {
  const { count } = await api<{ count: number }>(`/requests/${requestId}/offer-count`)
  return count
}

/** Bandeja: ofertas que me han hecho, u ofertas que he enviado. */
export type OfferBox = 'received' | 'sent'

export interface OfferListItem {
  offer: Offer
  /** Sobre qué se ofertó. */
  subjectKind: 'listing' | 'request'
  subjectTitle: string
  /** false si se borró o si la moderación lo retiró. */
  subjectAvailable: boolean
  subjectCover: string | null
  /** null cuando el asunto ya no está disponible: enlazar llevaría a "no encontrado". */
  subjectLink: string | null
  /** La otra parte (quien oferta si es recibida; el dueño si es enviada). */
  counterpartName: string
  counterpartAvatar: string | null
}

/**
 * Ofertas del usuario con sesión (recibidas o enviadas), ya enriquecidas por el servidor
 * con su asunto y la otra parte. El primer parámetro se mantiene por compatibilidad.
 */
export function fetchOffers(_userId: string, box: OfferBox): Promise<OfferListItem[]> {
  return api<OfferListItem[]>(`/offers?box=${box}`)
}

/** Una oferta con quien la envía, para mostrarla en el propio anuncio/petición. */
export interface OfferWithSender {
  offer: Offer
  senderName: string
  senderAvatar: string | null
}

/**
 * Ofertas sobre un anuncio o una petición. El servidor solo entrega las que me tocan: el
 * dueño ve las que ha recibido y quien oferta ve la suya.
 */
export function fetchOffersForRequest(requestId: string): Promise<OfferWithSender[]> {
  return api<OfferWithSender[]>(`/requests/${requestId}/offers`)
}

export function fetchOffersForListing(listingId: string): Promise<OfferWithSender[]> {
  return api<OfferWithSender[]>(`/listings/${listingId}/offers`)
}
