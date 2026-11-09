import { useEffect, useState } from 'react'
import { uploadListingPhoto } from '@/lib/api/storage'

/** Foto ya guardada (URL) o nueva por subir (File con object URL de preview). */
export type Photo = { kind: 'existing'; url: string } | { kind: 'new'; file: File; url: string }

/**
 * Gestión de fotos para formularios (anuncios y peticiones): fotos existentes + nuevas,
 * previews con object URLs, límite por tier, y subida diferida al enviar.
 */
export function usePhotoUploader({
  max,
  initialUrls = [],
}: {
  max: number
  initialUrls?: string[]
}) {
  const [photos, setPhotos] = useState<Photo[]>(() =>
    initialUrls.map((url) => ({ kind: 'existing', url }) as Photo),
  )

  // Libera las object URLs de las fotos nuevas al desmontar/cambiar.
  useEffect(() => {
    return () => {
      photos.forEach((p) => p.kind === 'new' && URL.revokeObjectURL(p.url))
    }
  }, [photos])

  function addFiles(list: FileList | null) {
    if (!list) return
    const room = max - photos.length
    const incoming: Photo[] = Array.from(list)
      .slice(0, Math.max(0, room))
      .map((file) => ({ kind: 'new', file, url: URL.createObjectURL(file) }))
    setPhotos((prev) => [...prev, ...incoming])
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const target = prev[index]
      if (target?.kind === 'new') URL.revokeObjectURL(target.url)
      return prev.filter((_, i) => i !== index)
    })
  }

  /** Sube las fotos nuevas y devuelve el array final de URLs (conserva las existentes). */
  async function resolveUrls(userId: string): Promise<string[]> {
    const urls: string[] = []
    for (const photo of photos) {
      urls.push(
        photo.kind === 'existing' ? photo.url : await uploadListingPhoto(userId, photo.file),
      )
    }
    return urls
  }

  return { photos, addFiles, removePhoto, resolveUrls, canAddMore: photos.length < max }
}
