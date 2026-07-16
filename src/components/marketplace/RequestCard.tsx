import { Clock, MapPin, User } from 'lucide-react'
import type { Request } from '@/lib/api/requests'
import { formatPriceShort, formatRelativeTime } from '@/lib/format'
import { ScaleTag } from './ScaleTag'

/**
 * Tarjeta de petición ("se busca"): borde discontinuo + acento naranja.
 * La tarjeta entera abre el detalle en un diálogo (`onOpen`), por eso el CTA interior
 * es un `span` con aspecto de botón: evita anidar interactivos dentro del role="button".
 */
export function RequestCard({
  request,
  brandName,
  authorName,
  authorLocation,
  onOpen,
}: {
  request: Request
  brandName?: string
  authorName?: string
  authorLocation?: string | null
  onOpen: () => void
}) {
  const cover = request.photos[0]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      aria-label={`Ver petición: ${request.title}`}
      className="group relative cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-border bg-card text-card-foreground shadow-sm transition-all duration-300 hover:border-accent hover:shadow-lg hover:shadow-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="absolute right-0 top-0 size-24 rounded-bl-[4rem] transition-all duration-300 group-hover:bg-accent/5" />

      <div className="relative z-10 p-4 md:p-5">
        <div className="flex items-start gap-3 md:gap-4">
          <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-border md:size-24">
            {cover ? (
              <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <div className="mm-grid-subtle grid h-full w-full place-items-center">
                <span className="mm-mono text-[0.6rem] text-muted-foreground">SIN FOTO</span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {request.scale && <ScaleTag scale={request.scale} />}
                {brandName && (
                  <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-0.5 font-mono text-xs font-semibold text-secondary-foreground">
                    {brandName}
                  </span>
                )}
              </div>
              {request.max_price_cents != null && (
                <p className="mm-mono text-xl font-bold text-accent md:hidden">
                  {formatPriceShort(request.max_price_cents)}
                </p>
              )}
            </div>

            <h3 className="mb-1 line-clamp-2 text-base font-semibold text-foreground transition-colors duration-300 group-hover:text-accent md:truncate md:text-lg">
              {request.title}
            </h3>

            {request.description && (
              <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                {request.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground md:gap-4">
              {authorName && (
                <span className="flex items-center gap-1">
                  <User className="size-3 shrink-0" />
                  {authorName}
                </span>
              )}
              {authorLocation && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3 shrink-0" />
                  {authorLocation}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="size-3 shrink-0" />
                {formatRelativeTime(request.created_at)}
              </span>
            </div>
          </div>

          {/* Columna derecha (escritorio): presupuesto + llamada a la acción */}
          {request.max_price_cents != null && (
            <div className="hidden shrink-0 flex-col items-end gap-2 md:flex">
              <div className="text-right">
                <p className="mm-mono text-xs text-muted-foreground">Ofrezco máximo:</p>
                <p className="mm-mono text-2xl font-bold text-accent">
                  {formatPriceShort(request.max_price_cents)}
                </p>
              </div>
              <span className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 font-display text-sm font-extrabold uppercase tracking-wide text-accent-foreground shadow-sm transition-colors group-hover:bg-accent/90">
                Enviar oferta
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
