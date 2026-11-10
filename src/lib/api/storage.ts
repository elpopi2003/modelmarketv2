import { upload } from './http'

/**
 * Subida de imágenes al servidor. Se recodifican a WebP sin metadatos (EXIF/GPS) y se
 * devuelve la URL para guardarla en el anuncio, la petición o el perfil.
 * El usuario sale de la sesión; el parámetro se mantiene por compatibilidad.
 */
export async function uploadAvatar(_userId: string, file: File): Promise<string> {
  const { url } = await upload<{ url: string }>('/uploads/avatar', file)
  return url
}

export async function uploadListingPhoto(_userId: string, file: File): Promise<string> {
  const { url } = await upload<{ url: string }>('/uploads/photo', file)
  return url
}

/**
 * Miniatura (600 px) de una foto subida al servidor, para tarjetas y listados. Las fotos
 * que no son nuestras (p. ej. las de v2 aún no migradas) se devuelven tal cual.
 */
export function thumbUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return /^\/uploads\/photos\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i.test(url)
    ? url.replace(/\.webp$/, '-sm.webp')
    : url
}
