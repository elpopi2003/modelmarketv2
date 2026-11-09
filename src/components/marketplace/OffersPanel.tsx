import { Link } from 'react-router-dom'
import { Check, MessageSquare, X } from 'lucide-react'
import type { OfferWithSender } from '@/lib/api/offers'
import type { OfferStatus } from '@/integrations/supabase/types'
import { formatPriceShort, formatRelativeTime } from '@/lib/format'
import { useRespondToOffer } from '@/hooks/useOffers'
import { OfferStatusBadge } from './OfferCard'
import { Button } from '@/components/ui/button'

/**
 * Ofertas mostradas sobre el propio anuncio/petición. Versión compacta de la bandeja:
 * aquí no se repite el objeto (ya lo estás viendo), solo quién, cuánto y en qué estado.
 *
 * `canRespond` lo decide quien lo usa (solo el dueño puede aceptar/rechazar; la BD lo
 * vuelve a comprobar de todos modos).
 */
export function OffersPanel({
  offers,
  isLoading,
  canRespond,
}: {
  offers: OfferWithSender[] | undefined
  isLoading?: boolean
  canRespond: boolean
}) {
  const respond = useRespondToOffer()

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-lg bg-muted" />
  }
  if (!offers || offers.length === 0) return null

  const pending = offers.filter((o) => o.offer.status === 'pending').length

  function handle(offerId: string, status: OfferStatus) {
    respond.mutate({ offerId, status })
  }

  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-border bg-card shadow-sm">
      <div className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-extrabold">
            {canRespond ? 'Ofertas recibidas' : 'Tu oferta'}
          </h2>
          {canRespond && pending > 0 && (
            <span className="mm-mono text-xs text-muted-foreground">
              {pending} pendiente{pending === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <ul className="divide-y divide-border">
          {offers.map(({ offer, senderName, senderAvatar }) => (
            <li
              key={offer.id}
              className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              {senderAvatar ? (
                <img
                  src={senderAvatar}
                  alt=""
                  loading="lazy"
                  className="size-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {senderName.charAt(0).toUpperCase()}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{senderName}</p>
                  <OfferStatusBadge status={offer.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(offer.created_at)}
                </p>
                {offer.message && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    “{offer.message}”
                  </p>
                )}
              </div>

              <p className="mm-mono shrink-0 text-xl font-bold text-accent">
                {formatPriceShort(offer.amount_cents)}
              </p>

              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                {offer.conversation_id && (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/mensajes/${offer.conversation_id}`} aria-label="Ver chat">
                      <MessageSquare />
                    </Link>
                  </Button>
                )}
                {canRespond && offer.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handle(offer.id, 'accepted')}
                      disabled={respond.isPending}
                    >
                      <Check /> Aceptar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handle(offer.id, 'rejected')}
                      disabled={respond.isPending}
                    >
                      <X /> Rechazar
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
