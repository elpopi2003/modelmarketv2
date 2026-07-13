import { Link } from 'react-router-dom'
import type { Listing } from '@/lib/api/listings'
import type { SubscriptionTier } from '@/lib/subscription'
import { formatPrice } from '@/lib/format'
import { ConditionBadge } from './ConditionBadge'
import { ScaleTag } from './ScaleTag'
import { FavoriteButton } from './FavoriteButton'
import { TierBadge } from './TierBadge'

/** Tarjeta de anuncio (listing tile) — estética blueprint del design system. */
export function ProductCard({
  listing,
  brandName,
  sellerTier,
}: {
  listing: Listing
  brandName?: string
  sellerTier?: SubscriptionTier
}) {
  const cover = listing.photos[0]

  return (
    <div className="group relative">
      <Link
        to={`/producto/${listing.id}`}
        className="block overflow-hidden rounded-md border-2 border-border bg-card transition-[border-color,box-shadow] duration-300 hover:border-primary hover:shadow-lg"
      >
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
          {listing.scale && (
            <div className="absolute left-3 top-3">
              <ScaleTag scale={listing.scale} />
            </div>
          )}
          <div className="absolute bottom-3 left-3">
            <ConditionBadge condition={listing.condition} />
          </div>
          {sellerTier && (
            <div className="absolute bottom-3 right-3">
              <TierBadge tier={sellerTier} />
            </div>
          )}
        </div>

        <div className="p-4">
          <p className="mm-mono mb-1 text-xs uppercase text-muted-foreground transition-colors group-hover:text-primary">
            {brandName ?? 'Sin marca'}
          </p>
          <h3 className="mb-2 line-clamp-2 font-sans text-base font-semibold leading-snug transition-colors group-hover:text-primary">
            {listing.title}
          </h3>
          <p className="mm-mono text-2xl font-bold transition-colors group-hover:text-primary">
            {formatPrice(listing.price_cents, listing.currency)}
          </p>
        </div>

        <span className="absolute bottom-0 left-0 h-1 w-full origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100 motion-reduce:transition-none" />
      </Link>

      <FavoriteButton listingId={listing.id} className="absolute right-3 top-3 rounded-full" />
    </div>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border-2 border-border bg-card">
      <div className="aspect-[4/3] animate-pulse bg-muted" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}
