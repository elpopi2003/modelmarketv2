import { supabase } from '@/integrations/supabase/client'
import { handleSupabaseError } from '@/lib/errors'
import type { Database } from '@/integrations/supabase/types'

export type Notification = Database['public']['Tables']['notifications']['Row']

export async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { data, error } = await supabase.rpc('unread_notification_count')
  if (error) handleSupabaseError(error)
  return data ?? 0
}

/** Marca como leídas todas las notificaciones del usuario (RLS: solo las suyas). */
export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  if (error) handleSupabaseError(error)
}
