import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useGetOrCreateConversation } from '@/hooks/useMessages'
import { useListing } from '@/hooks/useListings'
import { useBrands, useCategories } from '@/hooks/useCatalogs'
import { fetchPublicProfile } from '@/lib/api/profiles'
import { queryKeys } from '@/lib/queryKeys'
import { formatPrice } from '@/lib/format'
import { ConditionBadge } from '@/components/marketplace/ConditionBadge'
import { ScaleTag } from '@/components/marketplace/ScaleTag'
import { FavoriteButton } from '@/components/marketplace/FavoriteButton'
import { TierBadge } from '@/components/marketplace/TierBadge'
import { useFavoriteCount } from '@/hooks/useFavorites'
import { usePublicTiers } from '@/hooks/useSubscription'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function Producto() {
  const { id } = useParams<{ id: string }>()
  const { data: listing, isLoading } = useListing(id)
  const { data: brands } = useBrands()
  const { data: categories } = useCategories()
  const [activePhoto, setActivePhoto] = useState(0)

  const { data: seller } = useQuery({
    queryKey: listing ? queryKeys.profile.detail(listing.user_id) : ['profile', 'none'],
    queryFn: () => fetchPublicProfile(listing!.user_id),
    enabled: Boolean(listing?.user_id),
  })

  const { data: favoriteCount } = useFavoriteCount(id ?? '')
  const { data: sellerTiers } = usePublicTiers(listing ? [listing.user_id] : [])
  const { user } = useAuth()
  const navigate = useNavigate()
  const getOrCreateConversation = useGetOrCreateConversation()

  if (isLoading) {
    return (
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="h-96 animate-pulse rounded-md bg-muted" />
      </section>
    )
  }

  if (!listing) {
    return (
      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Anuncio no encontrado</h1>
        <p className="mt-2 text-muted-foreground">Puede que se haya vendido o retirado.</p>
        <Link to="/explorar" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">
          Volver a explorar
        </Link>
      </section>
    )
  }

  const brandName = listing.brand_id ? brands?.find((b) => b.id === listing.brand_id)?.name : null
  const categoryName = listing.category_id
    ? categories?.find((c) => c.id === listing.category_id)?.name
    : null
  const sellerName = seller?.display_name || seller?.username || 'Vendedor'
  const isOwner = user?.id === listing.user_id

  async function handleContact() {
    if (!user) {
      navigate('/auth')
      return
    }
    const conversationId = await getOrCreateConversation.mutateAsync(listing!.id)
    navigate(`/mensajes/${conversationId}`)
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <Link
        to="/explorar"
        className="mm-mono mb-6 inline-block text-xs uppercase text-muted-foreground hover:text-primary"
      >
        ← Volver al catálogo
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Galería */}
        <div>
          <div className="mm-card-blueprint aspect-[4/3] overflow-hidden">
            {listing.photos.length > 0 ? (
              <img
                src={listing.photos[activePhoto]}
                alt={listing.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="mm-grid-subtle flex h-full w-full items-center justify-center">
                <span className="mm-mono text-sm text-muted-foreground">SIN FOTO</span>
              </div>
            )}
          </div>
          {listing.photos.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {listing.photos.map((photo, i) => (
                <button
                  key={photo}
                  type="button"
                  onClick={() => setActivePhoto(i)}
                  className={cn(
                    'h-16 w-16 overflow-hidden rounded-md border-2',
                    i === activePhoto ? 'border-primary' : 'border-border',
                  )}
                  aria-label={`Foto ${i + 1}`}
                >
                  <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalle */}
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <ConditionBadge condition={listing.condition} />
            {listing.scale && <ScaleTag scale={listing.scale} />}
            {categoryName && (
              <span className="mm-mono text-xs uppercase text-muted-foreground">{categoryName}</span>
            )}
          </div>

          {brandName && (
            <p className="mm-mono mb-1 text-sm uppercase text-muted-foreground">{brandName}</p>
          )}
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-balance">
            {listing.title}
          </h1>

          <p className="mm-mono mt-4 text-4xl font-bold text-primary">
            {formatPrice(listing.price_cents, listing.currency)}
          </p>

          {listing.description && (
            <p className="mt-6 whitespace-pre-line leading-relaxed text-foreground">
              {listing.description}
            </p>
          )}

          {/* Vendedor */}
          <div className="mm-card mt-8 flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 font-mono text-sm font-semibold text-primary">
              {sellerName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="mm-mono text-xs uppercase text-muted-foreground">Vendedor</p>
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold">{sellerName}</p>
                <TierBadge tier={sellerTiers?.[listing.user_id]} />
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              {!isOwner && (
                <Button onClick={handleContact} disabled={getOrCreateConversation.isPending}>
                  {getOrCreateConversation.isPending ? 'Abriendo…' : 'Contactar vendedor'}
                </Button>
              )}
              <FavoriteButton listingId={listing.id} withLabel />
              {favoriteCount != null && favoriteCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  {favoriteCount === 1
                    ? '1 persona lo ha guardado'
                    : `${favoriteCount} personas lo han guardado`}
                </span>
              )}
            </div>
            {isOwner && <p className="text-xs text-muted-foreground">Este es tu anuncio.</p>}
          </div>
        </div>
      </div>
    </section>
  )
}
