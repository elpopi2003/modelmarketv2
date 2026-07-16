import { Link } from 'react-router-dom'
import { Check, MessageSquare, Undo2, X } from 'lucide-react'
import type { OfferListItem } from '@/lib/api/offers'
import type { OfferStatus } from '@/integrations/supabase/types'
import { formatPriceShort, formatRelativeTime, OFFER_STATUS_LABELS } from '@/lib/format'
import { useRespondToOffer } from '@/hooks/useOffers'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Tinte del sello según el estado de la oferta. */
const STATUS_STYLES: Record<OfferStatus, string> = {
  pending: 'bg-started/10 text-started-ink border-started/30',
  accepted: 'bg-sealed/10 text-sealed-ink border-sealed/30',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
  withdrawn: 'bg-muted text-muted-foreground border-border',
}

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[0.7rem] font-semibold uppercase tracking-wide',
        STATUS_STYLES[status],
      )}
    >
      {OFFER_STATUS_LABELS[status]}
    </span>
  )
}

/**
 * Una oferta en la bandeja. En "recibidas" se puede aceptar/rechazar;
 * en "enviadas", retirar mientras siga pendiente.
 */
export function OfferCard({ item, box }: { item: OfferListItem; box: 'received' | 'sent' }) {
  const respond = useRespondToOffer()
  const { offer } = item
  const isPending = offer.status === 'pending'

  function handle(status: OfferStatus) {
    respond.mutate({ offerId: offer.id, status })
  }

  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50 md:p-5">
      <div className="flex items-start gap-3 md:gap-4">
        <Link
          to={item.subjectLink}
          className="size-16 shrink-0 overflow-hidden rounded-lg border border-border md:size-20"
        >
          {item.subjectCover ? (
            <img src={item.subjectCover} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="mm-grid-subtle grid h-full w-full place-items-center">
              <span className="mm-mono text-[0.6rem] text-muted-foreground">SIN FOTO</span>
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="mm-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">
              {item.subjectKind === 'listing' ? 'Anuncio' : 'Petición'}
            </span>
            <OfferStatusBadge status={offer.status} />
          </div>

          <Link
            to={item.subjectLink}
            className="line-clamp-1 font-semibold text-foreground transition-colors hover:text-primary"
          >
            {item.subjectTitle}
          </Link>

          <p className="mt-1 text-sm text-muted-foreground">
            {box === 'received' ? 'De' : 'Para'}{' '}
            <span className="font-medium text-foreground">{item.counterpartName}</span> ·{' '}
            {formatRelativeTime(offer.created_at)}
          </p>

          {offer.message && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">“{offer.message}”</p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="mm-mono text-2xl font-bold text-accent">
            {formatPriceShort(offer.amount_cents)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {offer.conversation_id && (
          <Button asChild variant="outline" size="sm">
            <Link to={`/mensajes/${offer.conversation_id}`}>
              <MessageSquare /> Ver chat
            </Link>
          </Button>
        )}

        {isPending && box === 'received' && (
          <>
            <Button size="sm" onClick={() => handle('accepted')} disabled={respond.isPending}>
              <Check /> Aceptar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handle('rejected')}
              disabled={respond.isPending}
            >
              <X /> Rechazar
            </Button>
          </>
        )}

        {isPending && box === 'sent' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handle('withdrawn')}
            disabled={respond.isPending}
          >
            <Undo2 /> Retirar
          </Button>
        )}
      </div>

      {offer.status === 'accepted' && item.subjectKind === 'listing' && (
        <p className="mt-3 text-xs text-muted-foreground">
          Al aceptarla, el anuncio quedó marcado como reservado.
        </p>
      )}
    </div>
  )
}
