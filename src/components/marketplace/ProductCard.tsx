import { Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Listing } from '@/lib/api/listings'
import { formatPriceShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ConditionBadge } from './ConditionBadge'
import { OwnerActions } from './OwnerActions'
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
  isOwn = false,
  onDelete,
  onToggleSuspend,
  busy = false,
}: {
  listing: Listing
  brandName?: string
  sellerName?: string
  sellerAvatarUrl?: string | null
  shippingAvailable?: boolean
  reserved?: boolean
  /** El anuncio es del usuario que está viendo la lista. */
  isOwn?: boolean
  /** Borrado por su dueño. Solo se pasa cuando el anuncio es propio. */
  onDelete?: () => void
  /** Alterna entre activo y suspendido. Solo se pasa cuando el anuncio es propio. */
  onToggleSuspend?: () => void
  busy?: boolean
}) {
  const cover = listing.photos[0]
  // "Archivado" es el estado con el que se oculta del catálogo público.
  const suspended = listing.status === 'archived'
  // previous_status solo lo rellena la retirada administrativa.
  const moderated = listing.previous_status != null

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border-2 bg-card text-card-foreground shadow-sm transition-all duration-300',
        isOwn
          ? 'border-primary/50 bg-primary/[0.04] hover:border-primary hover:shadow-lg hover:shadow-primary/10'
          : 'border-border hover:border-primary hover:shadow-lg hover:shadow-primary/10',
        suspended && 'border-destructive/30 bg-muted/40',
      )}
    >
      {/* flex-1: iguala la altura del cuerpo para que los pies de acciones se alineen
          entre tarjetas de la misma fila. */}
      <Link to={`/producto/${listing.id}`} className="block flex-1">
        <div
          className={cn(
            'relative aspect-[4/3] overflow-hidden bg-muted',
            // Suspendido: se apaga la foto, para que se lea "esto no lo ve nadie".
            suspended && 'opacity-60 grayscale',
          )}
        >
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

          {isOwn && (
            <span className="absolute right-3 top-3 inline-flex items-center rounded-md border border-primary/40 bg-card/95 px-2 py-0.5 font-mono text-[0.7rem] font-bold uppercase tracking-wide text-primary shadow-sm">
              Tu anuncio
            </span>
          )}

          {suspended ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-md bg-destructive px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-destructive-foreground shadow-lg">
                {moderated ? 'Retirado' : 'Suspendido'}
              </span>
            </div>
          ) : (
            reserved && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="rotate-[-12deg] scale-110 rounded-md bg-accent px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-accent-foreground shadow-lg">
                  Reservado
                </span>
              </div>
            )
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

      {/* Fuera del <Link> para no anidar interactivos. En lo propio se sustituye por las
          acciones de dueño: guardar tu propio anuncio en favoritos no tiene sentido. */}
      {isOwn && onDelete && onToggleSuspend ? (
        <div className="border-t border-primary/20 p-4">
          <OwnerActions
            suspended={suspended}
            moderated={moderated}
            onToggleSuspend={onToggleSuspend}
            onDelete={onDelete}
            busy={busy}
            cascadeNote="Se borrarán también sus fotos, conversaciones y favoritos."
          />
        </div>
      ) : (
        <FavoriteButton listingId={listing.id} className="absolute bottom-4 right-4 rounded-full" />
      )}
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
