import { supabase } from '@/integrations/supabase/client'
import { handleSupabaseError } from '@/lib/errors'
import type { Database } from '@/integrations/supabase/types'

export type PublicProfile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'username' | 'display_name' | 'avatar_url' | 'location' | 'created_at'
>

const PUBLIC_COLUMNS = 'id, username, display_name, avatar_url, location, created_at'

/** Perfiles públicos de varios usuarios en una sola consulta (tarjetas de un listado). */
export async function fetchPublicProfiles(userIds: string[]): Promise<PublicProfile[]> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return []
  const { data, error } = await supabase.from('profiles').select(PUBLIC_COLUMNS).in('id', unique)
  if (error) handleSupabaseError(error)
  return data ?? []
}

/** Datos públicos del perfil de un usuario (para mostrar el vendedor). */
export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLIC_COLUMNS)
    .eq('id', userId)
    .maybeSingle()
  if (error) handleSupabaseError(error)
  return data
}
