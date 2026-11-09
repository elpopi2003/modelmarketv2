/**
 * Metadatos por ruta (título, descripción, Open Graph, canonical, robots).
 *
 * No usa ninguna librería de `<head>`: React 19 sube (hoist) a `<head>` los `<title>`,
 * `<meta>` y `<link>` que se rendericen en cualquier punto del árbol. Cada página monta
 * un <Seo/> con lo suyo; al navegar, React reemplaza estas etiquetas por las de la ruta
 * nueva. El `index.html` mantiene un título/descripción por defecto para el primer paint
 * y para clientes sin JS.
 */

const SITE_NAME = 'ModelMarket'
const DEFAULT_OG_IMAGE =
  'https://shanozqxmmdiqvqhffbz.supabase.co/storage/v1/object/public/brand/logo.png'

/** URL absoluta y canónica de la ruta actual, sin query ni hash. */
function canonicalUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return `${window.location.origin}${window.location.pathname}`
}

export interface SeoProps {
  /** Se compone como "<title> · ModelMarket". Pasa `titleExact` para evitar el sufijo. */
  title: string
  titleExact?: boolean
  description?: string
  /** Imagen para redes (Open Graph / Twitter). Por defecto, el logotipo. */
  image?: string
  /** Tipo Open Graph: 'website' (por defecto) o 'product' en fichas. */
  type?: 'website' | 'product' | 'article'
  /** Excluir de indexación (páginas privadas, 404, resultados vacíos). */
  noindex?: boolean
  /** JSON-LD ya construido (p. ej. un Product). Se serializa tal cual. */
  jsonLd?: Record<string, unknown>
}

export function Seo({ title, titleExact, description, image, type = 'website', noindex, jsonLd }: SeoProps) {
  const fullTitle = titleExact ? title : `${title} · ${SITE_NAME}`
  const url = canonicalUrl()
  const ogImage = image ?? DEFAULT_OG_IMAGE

  return (
    <>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {url && <link rel="canonical" href={url} />}

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      {url && <meta property="og:url" content={url} />}
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={ogImage} />

      {jsonLd && (
        // Google lee el JSON-LD esté donde esté en el documento; React lo renderiza aquí.
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </>
  )
}
