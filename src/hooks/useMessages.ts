import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchConversationList,
  fetchMessages,
  fetchUnreadCount,
  getOrCreateConversation,
  markConversationRead,
  sendMessage,
} from '@/lib/api/messages'
import { queryKeys } from '@/lib/queryKeys'
import { useAuth } from '@/hooks/useAuth'

export function useConversations() {
  const { user } = useAuth()
  const userId = user?.id
  return useQuery({
    queryKey: queryKeys.conversations.list(),
    queryFn: () => fetchConversationList(userId as string),
    enabled: Boolean(userId),
  })
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: conversationId
      ? queryKeys.conversations.messages(conversationId)
      : queryKeys.conversations.all,
    queryFn: () => fetchMessages(conversationId as string),
    enabled: Boolean(conversationId),
    refetchInterval: conversationId ? 5000 : false,
  })
}

export function useUnreadCount() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...queryKeys.conversations.all, 'unread'],
    queryFn: fetchUnreadCount,
    enabled: Boolean(user),
    refetchInterval: 20000,
  })
}

export function useSendMessage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      sendMessage(conversationId, user!.id, body),
    onSuccess: (_data, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(conversationId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() })
    },
  })
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) => markConversationRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.conversations.all, 'unread'] })
    },
  })
}

export function useGetOrCreateConversation() {
  return useMutation({
    mutationFn: (listingId: string) => getOrCreateConversation(listingId),
  })
}
