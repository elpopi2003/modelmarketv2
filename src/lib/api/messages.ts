import type { Database } from '@/integrations/supabase/types'
import { api } from './http'

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
  /**
   * ¿Sigue disponible el anuncio/petición para quien mira? false si se borró o si la
   * moderación lo retiró. La conversación se conserva: lo hablado sigue siendo suyo.
   */
  subjectAvailable: boolean
  subjectCover: string | null
  /** Ruta al asunto; null cuando ya no está disponible (enlazar daría "no encontrado"). */
  subjectLink: string | null
}

/**
 * Conversaciones del usuario con sesión, ya enriquecidas por el servidor (asunto y otra
 * parte) y sin las que ocultó por su lado. El parámetro se mantiene por compatibilidad.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function fetchConversationList(_userId?: string): Promise<ConversationListItem[]> {
  return api<ConversationListItem[]>('/conversations')
}

export function fetchMessages(conversationId: string): Promise<Message[]> {
  return api<Message[]>(`/conversations/${conversationId}/messages`)
}

/** Envía un mensaje. El remitente sale de la sesión. */
export function sendMessage(conversationId: string, body: string): Promise<Message> {
  return api<Message>(`/conversations/${conversationId}/messages`, { body: { body } })
}

/** Encuentra o crea la conversación del comprador para un anuncio. Devuelve su id. */
export async function getOrCreateConversation(listingId: string): Promise<string> {
  const { id } = await api<{ id: string }>('/conversations', { body: { listingId } })
  return id
}

export async function fetchUnreadCount(): Promise<number> {
  const { count } = await api<{ count: number }>('/messages/unread-count')
  return count
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await api(`/conversations/${conversationId}/read`, { method: 'POST', body: {} })
}
