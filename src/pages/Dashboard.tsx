import { thumbUrl } from '@/lib/api/storage'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDeleteListing, useMyListings } from '@/hooks/useListings'
import { formatPrice, pendingVisibilityLabel, STATUS_LABELS } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'

export default function Dashboard() {
  const { data: listings, isLoading } = useMyListings()
  const deleteListing = useDeleteListing()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setError(null)
    try {
      await deleteListing.mutateAsync(id)
      setConfirmId(null)
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Tus anuncios</h1>
        <Button asChild>
          <Link to="/publicar">Publicar anuncio</Link>
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

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
            <li
              key={listing.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                {listing.photos.length > 0 && (
                  <img
                    src={thumbUrl(listing.photos[0])}
                    alt={listing.title}
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
                  />
                )}
                <div className="min-w-0">
                  <Link to={`/producto/${listing.id}`} className="font-medium hover:underline">
                    {listing.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(listing.price_cents, listing.currency)} ·{' '}
                    {STATUS_LABELS[listing.status]}
                    {listing.status === 'active' && pendingVisibilityLabel(listing.visible_at)
                      ? ` · ${pendingVisibilityLabel(listing.visible_at)}`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to={`/anuncio/${listing.id}/editar`}>Editar</Link>
                </Button>
                {confirmId === listing.id ? (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteListing.isPending}
                      onClick={() => handleDelete(listing.id)}
                    >
                      {deleteListing.isPending ? 'Borrando…' : 'Sí, borrar'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>
                      No
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmId(listing.id)}>
                    Borrar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
