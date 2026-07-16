import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Lock, MapPin, Send, User, X } from 'lucide-react'
import type { Request } from '@/lib/api/requests'
import { formatPriceShort, formatRelativeTime } from '@/lib/format'
import { getCapabilities } from '@/lib/subscription'
import { useSubscription } from '@/hooks/useSubscription'
import { useAuth } from '@/hooks/useAuth'
import { ScaleTag } from './ScaleTag'
import { Button } from '@/components/ui/button'

/**
 * Detalle de una petición en diálogo modal (como el staging: la tarjeta no navega).
 * Usa el <dialog> nativo: trae foco atrapado, Esc y backdrop sin dependencias extra.
 *
 * El contenido es público; solo responder está reservado a PRO/Retail
 * (ver `canRespondToRequests` en la matriz de suscripciones).
 */
export function RequestDialog({
  request,
  brandName,
  categoryName,
  authorName,
  authorLocation,
  onClose,
}: {
  request: Request | null
  brandName?: string
  categoryName?: string
  authorName?: string
  authorLocation?: string | null
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const { user } = useAuth()
  const { data: tier } = useSubscription()
  const canRespond = getCapabilities(tier ?? 'free').canRespondToRequests

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (request && !el.open) el.showModal()
    if (!request && el.open) el.close()
  }, [request])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // Clic en el backdrop (el propio <dialog>, no su contenido) → cerrar.
        if (event.target === ref.current) onClose()
      }}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl rounded-lg border-2 border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-foreground/50"
      aria-label={request?.title}
    >
      {request && (
        <div className="max-h-[90vh] overflow-y-auto p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-balance text-xl font-semibold tracking-tight">{request.title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="-mr-2 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-6">
            {request.photos[0] && (
              <div className="aspect-video w-full overflow-hidden rounded-lg border border-border">
                <img src={request.photos[0]} alt="" className="h-full w-full object-cover" />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {request.scale && <ScaleTag scale={request.scale} />}
              {brandName && (
                <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                  {brandName}
                </span>
              )}
              {categoryName && (
                <span className="inline-flex items-center rounded-md border border-border px-2.5 py-0.5 text-xs font-semibold text-foreground">
                  {categoryName}
                </span>
              )}
            </div>

            {request.description && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Descripción</h3>
                <p className="whitespace-pre-line text-foreground">{request.description}</p>
              </div>
            )}

            {request.max_price_cents != null && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Ofrezco máximo:</p>
                <p className="mm-mono text-2xl font-bold text-accent">
                  {formatPriceShort(request.max_price_cents)}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
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

            {!user ? (
              <Button asChild variant="accent" size="lg" className="w-full">
                <Link to="/auth">
                  <Send /> Enviar oferta
                </Link>
              </Button>
            ) : canRespond ? (
              <Button variant="accent" size="lg" className="w-full" disabled>
                <Send /> Enviar oferta (próximamente)
              </Button>
            ) : (
              <div className="space-y-2">
                <Button asChild variant="accent" size="lg" className="w-full">
                  <Link to="/precios">
                    <Lock /> Hazte PRO para enviar ofertas
                  </Link>
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Las peticiones son públicas, pero responder a su autor es una función PRO y
                  Retail.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
