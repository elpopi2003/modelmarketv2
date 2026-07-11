import { supabase } from '@/integrations/supabase/client'
import { handleSupabaseError } from '@/lib/errors'
import type { Database } from '@/integrations/supabase/types'

export type Conversation = Database['public']['Tables']['conversations']['Row']
export type Message = Database['public']['Tables']['messages']['Row']

export interface ConversationListItem {
  conversation: Conversation
  otherUserId: string
  otherName: string
  listingTitle: string
  listingCover: string | null
}

/** Conversaciones del usuario (enriquecidas con anuncio y otro participante). */
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
  const listingIds = [...new Set(mine.map((c) => c.listing_id))]
  const otherIds = [...new Set(mine.map(otherId))]

  const [listingsRes, profilesRes] = await Promise.all([
    supabase.from('listings').select('id, title, photos').in('id', listingIds),
    supabase.from('profiles').select('id, display_name, username').in('id', otherIds),
  ])
  if (listingsRes.error) handleSupabaseError(listingsRes.error)
  if (profilesRes.error) handleSupabaseError(profilesRes.error)

  const listingMap = new Map((listingsRes.data ?? []).map((l) => [l.id, l]))
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]))

  return mine.map((conversation) => {
    const listing = listingMap.get(conversation.listing_id)
    const profile = profileMap.get(otherId(conversation))
    return {
      conversation,
      otherUserId: otherId(conversation),
      otherName: profile?.display_name || profile?.username || 'Usuario',
      listingTitle: listing?.title ?? 'Anuncio',
      listingCover: listing?.photos?.[0] ?? null,
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
