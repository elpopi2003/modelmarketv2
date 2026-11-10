import { describe, expect, it } from 'vitest'
import { absoluteUrl } from './url'

describe('absoluteUrl', () => {
  it('completa las rutas del propio sitio con el origen actual', () => {
    expect(absoluteUrl('/brand/logo.png')).toBe(`${window.location.origin}/brand/logo.png`)
    expect(absoluteUrl('uploads/a.webp')).toBe(`${window.location.origin}/uploads/a.webp`)
  })

  it('deja tal cual las URLs que ya son absolutas', () => {
    expect(absoluteUrl('https://cdn.example/x.png')).toBe('https://cdn.example/x.png')
  })
})
