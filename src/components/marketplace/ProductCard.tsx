import { Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Listing } from '@/lib/api/listings'
import { formatPriceShort } from '@/lib/format'
import { ConditionBadge } from './ConditionBadge'
import { ScaleTag } from './ScaleTag'
import { FavoriteButton } from './FavoriteButton'

/**
 * Tarjeta de anuncio. Estructura: imagen (chip de escala + lazo reservado) →
 * banda de estado (condición + envío) → contenido (marca, título, precio, vendedor).
 *
 * `shippingAvailable` y `reserved` son opcionales: los campos correspondientes todavía
 * no existen en la BD (ver plan de ampliación del modelo). Cuando existan, se pasan aquí.
 */
export function ProductCard({
  listing,
  brandName,
  sellerName,
  sellerAvatarUrl,
  shippingAvailable = false,
  reserved = false,
}: {
  listing: Listing
  brandName?: string
  sellerName?: string
  sellerAvatarUrl?: string | null
  shippingAvailable?: boolean
  reserved?: boolean
}) {
  const cover = listing.photos[0]

  return (
    <div className="group relative overflow-hidden rounded-lg border-2 border-border bg-card text-card-foreground shadow-sm transition-all duration-300 hover:border-primary hover:shadow-lg hover:shadow-primary/10">
      <Link to={`/producto/${listing.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {cover ? (
            <img
              src={cover}
              alt={listing.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 motion-reduce:transform-none"
            />
          ) : (
            <div className="mm-grid-subtle flex h-full w-full items-center justify-center">
              <span className="mm-mono text-xs text-muted-foreground">SIN FOTO</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {listing.scale && (
            <ScaleTag
              scale={listing.scale}
              className="absolute left-3 top-3 transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
            />
          )}

          {reserved && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rotate-[-12deg] scale-110 rounded-md bg-accent px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-accent-foreground shadow-lg">
                Reservado
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
          <ConditionBadge condition={listing.condition} />
          {shippingAvailable && (
            <span className="flex items-center gap-1 rounded-md bg-sealed/15 px-2 py-0.5 text-xs font-medium text-sealed-ink">
              <Truck className="size-3.5 shrink-0" />
              Envío disponible
            </span>
          )}
        </div>

        <div className="p-4">
          <p className="mm-mono mb-1 text-xs uppercase tracking-wider text-muted-foreground transition-colors duration-300 group-hover:text-primary">
            {brandName ?? 'Sin marca'}
          </p>
          <h3 className="mb-2 line-clamp-2 font-semibold leading-tight text-foreground transition-colors duration-300 group-hover:text-primary">
            {listing.title}
          </h3>

          <p className="mm-mono text-2xl font-bold text-foreground transition-colors duration-300 group-hover:text-primary">
            {formatPriceShort(listing.price_cents, listing.currency)}
          </p>

          {sellerName && (
            <div className="mt-1 flex items-center gap-2">
              {sellerAvatarUrl ? (
                <img
                  src={sellerAvatarUrl}
                  alt=""
                  loading="lazy"
                  className="size-5 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground">
                  {sellerName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="truncate text-xs text-muted-foreground">{sellerName}</span>
            </div>
          )}
        </div>
      </Link>

      {/* Fuera del <Link> para no anidar interactivos; ocupa el hueco de acciones del diseño. */}
      <FavoriteButton listingId={listing.id} className="absolute bottom-4 right-4 rounded-full" />
    </div>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border-2 border-border bg-card shadow-sm">
      <div className="aspect-[4/3] animate-pulse bg-muted" />
      <div className="border-b border-border bg-muted/30 px-4 py-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-2 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}
