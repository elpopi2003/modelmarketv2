import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchOwnProfile,
  updateOwnProfile,
  type Profile,
  type ProfileUpdate,
} from '@/lib/api/profiles'
import { uploadAvatar } from '@/lib/api/storage'
import { queryKeys } from '@/lib/queryKeys'
import { useAuth } from '@/hooks/useAuth'

export type { Profile, ProfileUpdate }

/** Perfil del usuario autenticado, con mutación de actualización. */
export function useProfile() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: userId ? queryKeys.profile.detail(userId) : queryKeys.profile.all,
    queryFn: fetchOwnProfile,
    enabled: Boolean(userId),
  })

  const mutation = useMutation({
    mutationFn: (updates: Omit<ProfileUpdate, 'id'>): Promise<Profile> => {
      if (!userId) throw new Error('No hay usuario autenticado')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { created_at, updated_at, ...rest } = updates
      return updateOwnProfile(rest)
    },
    onSuccess: (data) => {
      if (userId) queryClient.setQueryData(queryKeys.profile.detail(userId), data)
    },
  })

  /** Sube la imagen y la fija como avatar. El servidor borra el anterior. */
  async function setAvatar(file: File): Promise<void> {
    if (!userId) throw new Error('No hay usuario autenticado')
    const url = await uploadAvatar(userId, file)
    await mutation.mutateAsync({ avatar_url: url })
  }

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
