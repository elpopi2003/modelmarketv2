import { supabase } from '@/integrations/supabase/client'
import { handleSupabaseError } from '@/lib/errors'

const LISTING_PHOTOS_BUCKET = 'listing-photos'
const AVATARS_BUCKET = 'avatars'

/** Sube el avatar a la carpeta del usuario y devuelve su URL pública. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
  const path = `${userId}/avatar-${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) handleSupabaseError(error)

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** Sube una foto a la carpeta del usuario y devuelve su URL pública. */
export async function uploadListingPhoto(userId: string, file: File): Promise<string> {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(LISTING_PHOTOS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) handleSupabaseError(error)

  const { data } = supabase.storage.from(LISTING_PHOTOS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
