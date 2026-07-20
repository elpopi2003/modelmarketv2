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

/** Bandeja: ofertas que me han hecho, u ofertas que he enviado. */
export type OfferBox = 'received' | 'sent'

export interface OfferListItem {
  offer: Offer
  /** Sobre qué se ofertó. */
  subjectKind: 'listing' | 'request'
  subjectTitle: string
  /** false si se borró o si la moderación lo retiró: la RLS deja de entregarlo. */
  subjectAvailable: boolean
  subjectCover: string | null
  /** null cuando el asunto ya no está disponible: enlazar llevaría a "no encontrado". */
  subjectLink: string | null
  /** La otra parte (quien oferta si es recibida; el dueño si es enviada). */
  counterpartName: string
  counterpartAvatar: string | null
}

/**
 * Ofertas del usuario, enriquecidas con su objeto y la otra parte.
 * La RLS ya limita a las ofertas en las que participa; el filtro por columna
 * decide la bandeja.
 */
export async function fetchOffers(userId: string, box: OfferBox): Promise<OfferListItem[]> {
  const column = box === 'received' ? 'to_user_id' : 'from_user_id'
  const { data: offers, error } = await supabase
    .from('offers')
    .select('*')
    .eq(column, userId)
    .order('created_at', { ascending: false })
  if (error) handleSupabaseError(error)
  if (!offers || offers.length === 0) return []

  const isString = (value: string | null): value is string => Boolean(value)
  const listingIds = [...new Set(offers.map((o) => o.listing_id).filter(isString))]
  const requestIds = [...new Set(offers.map((o) => o.request_id).filter(isString))]
  const otherIds = [
    ...new Set(offers.map((o) => (box === 'received' ? o.from_user_id : o.to_user_id))),
  ]

  const [listingsRes, requestsRes, profilesRes] = await Promise.all([
    supabase.from('listings').select('id, title, photos').in('id', listingIds),
    supabase.from('requests').select('id, title, photos').in('id', requestIds),
    supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', otherIds),
  ])
  if (listingsRes.error) handleSupabaseError(listingsRes.error)
  if (requestsRes.error) handleSupabaseError(requestsRes.error)
  if (profilesRes.error) handleSupabaseError(profilesRes.error)

  const listingMap = new Map((listingsRes.data ?? []).map((l) => [l.id, l]))
  const requestMap = new Map((requestsRes.data ?? []).map((r) => [r.id, r]))
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]))

  return offers.map((offer) => {
    const kind: 'listing' | 'request' = offer.listing_id ? 'listing' : 'request'
    const subject = offer.listing_id
      ? listingMap.get(offer.listing_id)
      : offer.request_id
        ? requestMap.get(offer.request_id)
        : undefined
    const other = profileMap.get(box === 'received' ? offer.from_user_id : offer.to_user_id)

    return {
      offer,
      subjectKind: kind,
      subjectTitle:
        subject?.title ?? (kind === 'listing' ? 'Anuncio no disponible' : 'Petición no disponible'),
      subjectAvailable: Boolean(subject),
      subjectCover: subject?.photos?.[0] ?? null,
      subjectLink: !subject
        ? null
        : kind === 'listing'
          ? `/producto/${offer.listing_id}`
          : `/peticion/${offer.request_id}`,
      counterpartName: other?.display_name || other?.username || 'Usuario',
      counterpartAvatar: other?.avatar_url ?? null,
    }
  })
}

/** Una oferta con quien la envía, para mostrarla en el propio anuncio/petición. */
export interface OfferWithSender {
  offer: Offer
  senderName: string
  senderAvatar: string | null
}

/**
 * Ofertas sobre un anuncio o una petición, con el perfil de quien oferta.
 * La RLS ya limita lo visible: el dueño ve las que ha recibido, y quien oferta
 * ve la suya. No hace falta filtrar aquí.
 */
async function fetchOffersForTarget(
  column: 'listing_id' | 'request_id',
  targetId: string,
): Promise<OfferWithSender[]> {
  const { data: offers, error } = await supabase
    .from('offers')
    .select('*')
    .eq(column, targetId)
    .order('created_at', { ascending: false })
  if (error) handleSupabaseError(error)
  if (!offers || offers.length === 0) return []

  const senderIds = [...new Set(offers.map((o) => o.from_user_id))]
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .in('id', senderIds)
  if (profilesError) handleSupabaseError(profilesError)

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  return offers.map((offer) => {
    const sender = profileMap.get(offer.from_user_id)
    return {
      offer,
      senderName: sender?.display_name || sender?.username || 'Usuario',
      senderAvatar: sender?.avatar_url ?? null,
    }
  })
}

export function fetchOffersForRequest(requestId: string): Promise<OfferWithSender[]> {
  return fetchOffersForTarget('request_id', requestId)
}

export function fetchOffersForListing(listingId: string): Promise<OfferWithSender[]> {
  return fetchOffersForTarget('listing_id', listingId)
}
