/**
 * Completa una ruta relativa del propio sitio (`/uploads/...`, `/brand/logo.png`) con el
 * origen actual. Las redes sociales (og:image) y Google (JSON-LD) exigen URLs absolutas.
 */
export function absoluteUrl(src: string): string {
  if (/^https?:\/\//.test(src) || typeof window === 'undefined') return src
  return `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}`
}
