import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Inbox, Send } from 'lucide-react'
import { useOffersBox } from '@/hooks/useOffers'
import { OfferCard } from '@/components/marketplace/OfferCard'
import type { OfferBox } from '@/lib/api/offers'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TABS: { value: OfferBox; label: string; Icon: typeof Inbox }[] = [
  { value: 'received', label: 'Recibidas', Icon: Inbox },
  { value: 'sent', label: 'Enviadas', Icon: Send },
]

export default function Ofertas() {
  const [box, setBox] = useState<OfferBox>('received')
  const { data: items, isLoading } = useOffersBox(box)

  const pendingCount = (items ?? []).filter((i) => i.offer.status === 'pending').length

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Ofertas</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Las ofertas que te hacen sobre tus anuncios y peticiones, y las que envías tú.
      </p>

      {/* Bandejas */}
      <div className="mb-6 inline-flex rounded-lg border-2 border-border bg-card p-1">
        {TABS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setBox(value)}
            aria-current={box === value}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 font-display text-sm font-extrabold uppercase tracking-wide transition-colors',
              box === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {box === 'received' && pendingCount > 0 && (
        <p className="mb-4 rounded-md border border-started/30 bg-started/10 px-3 py-2 text-sm text-started-ink">
          Tienes {pendingCount} {pendingCount === 1 ? 'oferta pendiente' : 'ofertas pendientes'} de
          respuesta.
        </p>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">
            {box === 'received'
              ? 'Todavía no has recibido ofertas. Aparecerán aquí cuando alguien se interese por tus anuncios o peticiones.'
              : 'Todavía no has enviado ninguna oferta.'}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/explorar">Explorar anuncios</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <OfferCard key={item.offer.id} item={item} box={box} />
          ))}
        </div>
      )}
    </section>
  )
}
