import { describe, expect, it } from 'vitest'
import { thumbUrl } from './storage'

describe('thumbUrl', () => {
  const id = '2f1c7c1e-9a4b-4e2a-8f00-0123456789ab'
  const user = '8181aee8-cb74-48a2-88bd-2d139785525d'

  it('usa la miniatura de 600 px de las fotos subidas al servidor', () => {
    expect(thumbUrl(`/uploads/photos/${user}/${id}.webp`)).toBe(
      `/uploads/photos/${user}/${id}-sm.webp`,
    )
  })

  it('deja tal cual las fotos externas, los avatares y los valores vacíos', () => {
    const external = 'https://x.supabase.co/storage/v1/object/public/listing-photos/a.jpg'
    expect(thumbUrl(external)).toBe(external)
    expect(thumbUrl(`/uploads/avatars/${user}/${id}.webp`)).toBe(
      `/uploads/avatars/${user}/${id}.webp`,
    )
    expect(thumbUrl(undefined)).toBeUndefined()
    expect(thumbUrl(null)).toBeUndefined()
  })
})
