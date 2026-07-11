import { Link } from 'react-router-dom'
import { useMyListings } from '@/hooks/useListings'
import { formatPrice, STATUS_LABELS } from '@/lib/format'
import { Button } from '@/components/ui/button'

export default function Dashboard() {
  const { data: listings, isLoading } = useMyListings()

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Tus anuncios</h1>
        <Button asChild>
          <Link to="/publicar">Publicar anuncio</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !listings || listings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Aún no has publicado ningún anuncio.</p>
          <Button asChild className="mt-4">
            <Link to="/publicar">Publica el primero</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {listings.map((listing) => (
            <li key={listing.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <Link
                  to={`/producto/${listing.id}`}
                  className="font-medium hover:underline"
                >
                  {listing.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(listing.price_cents, listing.currency)} ·{' '}
                  {STATUS_LABELS[listing.status]}
                </p>
              </div>
              {listing.photos.length > 0 && (
                <img
                  src={listing.photos[0]}
                  alt={listing.title}
                  loading="lazy"
                  className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
