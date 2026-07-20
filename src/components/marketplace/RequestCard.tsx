import { Clock, MapPin, User } from 'lucide-react'
import type { Request } from '@/lib/api/requests'
import { formatPriceShort, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { OwnerActions } from './OwnerActions'
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
  /** La petición es del usuario que está viendo la lista. */
  isOwn = false,
  onOpen,
  onDelete,
  onToggleSuspend,
  busy = false,
}: {
  request: Request
  brandName?: string
  authorName?: string
  authorLocation?: string | null
  isOwn?: boolean
  onOpen: () => void
  /** Borrado por su autor. Solo se pasa cuando la petición es propia. */
  onDelete?: () => void
  /** Alterna entre abierta y suspendida. Solo se pasa cuando la petición es propia. */
  onToggleSuspend?: () => void
  busy?: boolean
}) {
  const cover = request.photos[0]
  // "Cerrada" es el estado con el que se oculta del listado público.
  const suspended = request.status === 'closed'
  // previous_status solo lo rellena la retirada administrativa.
  const moderated = request.previous_status != null

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
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-lg border-2 border-dashed bg-card text-card-foreground shadow-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isOwn
          ? // Las propias se distinguen con el azul de marca y un fondo tenue, para
            // localizarlas de un vistazo entre las del resto.
            'border-primary/50 bg-primary/[0.04] hover:border-primary hover:shadow-lg hover:shadow-primary/10'
          : 'border-border hover:border-accent hover:shadow-lg hover:shadow-accent/10',
        // Suspendida: apagada, para que se lea "esto no lo está viendo nadie".
        suspended && 'border-destructive/30 bg-muted/40 opacity-75',
      )}
    >
      <div
        className={cn(
          'absolute right-0 top-0 size-24 rounded-bl-[4rem] transition-all duration-300',
          isOwn ? 'group-hover:bg-primary/5' : 'group-hover:bg-accent/5',
        )}
      />

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
                {isOwn && (
                  <span className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[0.7rem] font-bold uppercase tracking-wide text-primary">
                    Tu petición
                  </span>
                )}
                {suspended && (
                  <span className="inline-flex items-center rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 font-mono text-[0.7rem] font-bold uppercase tracking-wide text-destructive">
                    {moderated ? 'Retirada' : 'Suspendida'}
                  </span>
                )}
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

            <h3
              className={cn(
                'mb-1 line-clamp-2 text-base font-semibold text-foreground transition-colors duration-300 md:truncate md:text-lg',
                isOwn ? 'group-hover:text-primary' : 'group-hover:text-accent',
              )}
            >
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

          {/* Columna derecha (escritorio): presupuesto y acción según de quién sea */}
          <div className="hidden shrink-0 flex-col items-end gap-2 md:flex">
            {request.max_price_cents != null && (
              <div className="text-right">
                <p className="mm-mono text-xs text-muted-foreground">Ofrezco máximo:</p>
                <p className="mm-mono text-2xl font-bold text-accent">
                  {formatPriceShort(request.max_price_cents)}
                </p>
              </div>
            )}

            {!isOwn && request.max_price_cents != null && (
              <span className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 font-display text-sm font-extrabold uppercase tracking-wide text-accent-foreground shadow-sm transition-colors group-hover:bg-accent/90">
                Enviar oferta
              </span>
            )}
          </div>
        </div>

        {/* Pie de acciones del dueño. Va aquí, y no en la columna derecha, porque esa
            está oculta en móvil: dentro no habría forma de suspender ni borrar. */}
        {isOwn && onDelete && onToggleSuspend && (
          <div className="mt-4 border-t border-primary/20 pt-3">
            <OwnerActions
              suspended={suspended}
              moderated={moderated}
              onToggleSuspend={onToggleSuspend}
              onDelete={onDelete}
              busy={busy}
              cascadeNote="Se borrarán también sus ofertas y conversaciones."
            />
          </div>
        )}
      </div>
    </div>
  )
}
