import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
} from '@/lib/api/notifications'
import { queryKeys } from '@/lib/queryKeys'
import { useAuth } from '@/hooks/useAuth'

export function useNotifications() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: fetchNotifications,
    enabled: Boolean(user),
    refetchInterval: 30000,
  })
}

export function useUnreadNotificationCount() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: fetchUnreadNotificationCount,
    enabled: Boolean(user),
    refetchInterval: 30000,
  })
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}
