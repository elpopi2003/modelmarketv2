import type { Database } from '@/integrations/supabase/types'
import { api } from './http'

export type Notification = Database['public']['Tables']['notifications']['Row']

/** Últimas 50 notificaciones del usuario con sesión. */
export const fetchNotifications = () => api<Notification[]>('/notifications')

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { count } = await api<{ count: number }>('/notifications/unread-count')
  return count
}

/** Marca como leídas todas las notificaciones del usuario. */
export async function markAllNotificationsRead(): Promise<void> {
  await api('/notifications/read-all', { method: 'POST', body: {} })
}
