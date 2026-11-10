import type { Database } from '@/integrations/supabase/types'
import { api } from './http'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type PublicProfile = Pick<
  Profile,
  'id' | 'username' | 'display_name' | 'avatar_url' | 'location' | 'created_at'
>

/** El servidor acepta hasta 100 IDs por consulta. */
const BATCH = 100

/** Perfiles públicos de varios usuarios (tarjetas de un listado). */
export async function fetchPublicProfiles(userIds: string[]): Promise<PublicProfile[]> {
  const unique = [...new Set(userIds)]
  const out: PublicProfile[] = []
  for (let i = 0; i < unique.length; i += BATCH) {
    const ids = unique.slice(i, i + BATCH).join(',')
    out.push(...(await api<PublicProfile[]>(`/profiles?ids=${ids}`)))
  }
  return out
}

/** Datos públicos del perfil de un usuario (para mostrar el vendedor). */
export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  try {
    return await api<PublicProfile>(`/profiles/${userId}`)
  } catch (error) {
    if ((error as { code?: string }).code === 'not_found') return null
    throw error
  }
}

/** Perfil completo del usuario con sesión (bio y preferencias incluidas). */
export const fetchOwnProfile = () => api<Profile>('/profile')

export function updateOwnProfile(updates: Omit<ProfileUpdate, 'id' | 'created_at' | 'updated_at'>) {
  return api<Profile>('/profile', { method: 'PATCH', body: updates })
}
