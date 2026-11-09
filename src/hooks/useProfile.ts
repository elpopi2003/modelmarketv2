import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { uploadAvatar } from '@/lib/api/storage'
import { queryKeys } from '@/lib/queryKeys'
import { handleSupabaseError } from '@/lib/errors'
import { useAuth } from '@/hooks/useAuth'
import type { Database } from '@/integrations/supabase/types'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) handleSupabaseError(error)
  return data
}

/** Perfil del usuario autenticado, con mutación de actualización (upsert defensivo). */
export function useProfile() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: userId ? queryKeys.profile.detail(userId) : queryKeys.profile.all,
    queryFn: () => fetchProfile(userId as string),
    enabled: Boolean(userId),
  })

  const mutation = useMutation({
    mutationFn: async (updates: Omit<ProfileUpdate, 'id'>): Promise<Profile> => {
      if (!userId) throw new Error('No hay usuario autenticado')
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: userId, ...updates })
        .select('*')
        .single()
      if (error) handleSupabaseError(error)
      return data as Profile
    },
    onSuccess: (data) => {
      if (userId) queryClient.setQueryData(queryKeys.profile.detail(userId), data)
    },
  })

  /** Sube el fichero al bucket de avatares y lo fija como avatar del perfil. */
  async function setAvatar(file: File): Promise<void> {
    if (!userId) throw new Error('No hay usuario autenticado')
    const url = await uploadAvatar(userId, file)
    await mutation.mutateAsync({ avatar_url: url })
  }

  /** Quita el avatar del perfil (el fichero queda en storage; no es visible sin la URL). */
  async function removeAvatar(): Promise<void> {
    await mutation.mutateAsync({ avatar_url: null })
  }

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    updateProfile: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    setAvatar,
    removeAvatar,
  }
}
