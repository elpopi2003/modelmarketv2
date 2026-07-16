import { supabase } from '@/integrations/supabase/client'
import { handleSupabaseError } from '@/lib/errors'
import type { Database } from '@/integrations/supabase/types'

export type Conversation = Database['public']['Tables']['conversations']['Row']
export type Message = Database['public']['Tables']['messages']['Row']

/** Un hilo cuelga de un anuncio o de una petición: el "asunto" de la conversación. */
export type ConversationSubjectKind = 'listing' | 'request'

export interface ConversationListItem {
  conversation: Conversation
  otherUserId: string
  otherName: string
  subjectKind: ConversationSubjectKind
  subjectTitle: string
  subjectCover: string | null
  /** Ruta al anuncio o petición de origen. */
  subjectLink: string
}

/** Conversaciones del usuario (enriquecidas con su asunto y el otro participante). */
export async function fetchConversationList(userId: string): Promise<ConversationListItem[]> {
  const { data: convs, error } = await supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) handleSupabaseError(error)

  // Filtra las que el usuario ha soft-borrado por su lado.
  const mine = (convs ?? []).filter((c) =>
    userId === c.buyer_id ? !c.buyer_deleted_at : !c.seller_deleted_at,
  )
  if (mine.length === 0) return []

  const otherId = (c: Conversation) => (userId === c.buyer_id ? c.seller_id : c.buyer_id)
  const isString = (value: string | null): value is string => Boolean(value)
  const listingIds = [...new Set(mine.map((c) => c.listing_id).filter(isString))]
  const requestIds = [...new Set(mine.map((c) => c.request_id).filter(isString))]
  const otherIds = [...new Set(mine.map(otherId))]

  const [listingsRes, requestsRes, profilesRes] = await Promise.all([
    supabase.from('listings').select('id, title, photos').in('id', listingIds),
    supabase.from('requests').select('id, title, photos').in('id', requestIds),
    supabase.from('profiles').select('id, display_name, username').in('id', otherIds),
  ])
  if (listingsRes.error) handleSupabaseError(listingsRes.error)
  if (requestsRes.error) handleSupabaseError(requestsRes.error)
  if (profilesRes.error) handleSupabaseError(profilesRes.error)

  const listingMap = new Map((listingsRes.data ?? []).map((l) => [l.id, l]))
  const requestMap = new Map((requestsRes.data ?? []).map((r) => [r.id, r]))
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]))

  return mine.map((conversation) => {
    const profile = profileMap.get(otherId(conversation))
    const subject = conversation.listing_id
      ? listingMap.get(conversation.listing_id)
      : conversation.request_id
        ? requestMap.get(conversation.request_id)
        : undefined
    const kind: ConversationSubjectKind = conversation.listing_id ? 'listing' : 'request'

    return {
      conversation,
      otherUserId: otherId(conversation),
      otherName: profile?.display_name || profile?.username || 'Usuario',
      subjectKind: kind,
      subjectTitle: subject?.title ?? (kind === 'listing' ? 'Anuncio' : 'Petición'),
      subjectCover: subject?.photos?.[0] ?? null,
      subjectLink:
        kind === 'listing' ? `/producto/${conversation.listing_id}` : `/peticion/${conversation.request_id}`,
    }
  })
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body })
    .select('*')
    .single()
  if (error) handleSupabaseError(error)
  return data as Message
}

/** RPC: encuentra o crea la conversación del comprador para un anuncio. Devuelve su id. */
export async function getOrCreateConversation(listingId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    _listing_id: listingId,
  })
  if (error) handleSupabaseError(error)
  return data as string
}

export async function fetchUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('unread_message_count')
  if (error) handleSupabaseError(error)
  return data ?? 0
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_read', {
    _conversation_id: conversationId,
  })
  if (error) handleSupabaseError(error)
}
