import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronRight,
  CircleCheck,
  CircleSlash,
  Flag,
  Handshake,
  MapPin,
  MessageSquare,
  Package,
  PackageOpen,
  Send,
  Share2,
  Truck,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useGetOrCreateConversation } from '@/hooks/useMessages'
import { useListing } from '@/hooks/useListings'
import { useBrands, useCategories } from '@/hooks/useCatalogs'
import { incrementListingViews } from '@/lib/api/listings'
import { fetchPublicProfile } from '@/lib/api/profiles'
import { queryKeys } from '@/lib/queryKeys'
import {
  CONDITION_DESCRIPTIONS,
  CONDITION_LABELS,
  DECALS_LABELS,
  formatPriceShort,
} from '@/lib/format'
import { ConditionBadge } from '@/components/marketplace/ConditionBadge'
import { OfferForm } from '@/components/marketplace/OfferForm'
import { OffersPanel } from '@/components/marketplace/OffersPanel'
import { ReportDialog } from '@/components/marketplace/ReportDialog'
import { useListingOffers } from '@/hooks/useOffers'
import { ScaleTag } from '@/components/marketplace/ScaleTag'
import { FavoriteButton } from '@/components/marketplace/FavoriteButton'
import { TierBadge } from '@/components/marketplace/TierBadge'
import { useFavoriteCount } from '@/hooks/useFavorites'
import { usePublicTiers } from '@/hooks/useSubscription'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const panel =
  'group relative overflow-hidden rounded-lg border-2 border-border bg-card text-card-foreground shadow-sm transition-all duration-300'

/** Una de las tres celdas de la fila de confianza (estado / calcas / entrega). */
function TrustCell({
  Icon,
  tone,
  title,
  children,
}: {
  Icon: ComponentType<{ className?: string }>
  tone: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-3 text-center">
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-lg transition-transform duration-300 group-hover:scale-110 motion-reduce:transform-none',
          tone,
        )}
      >
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {children}
      </div>
    </div>
  )
}

export default function Producto() {
  const { id } = useParams<{ id: string }>()
  const { data: listing, isLoading } = useListing(id)
  const { data: brands } = useBrands()
  const { data: categories } = useCategories()
  const [activePhoto, setActivePhoto] = useState(0)
  const [shared, setShared] = useState(false)
  const [offering, setOffering] = useState(false)
  const [reporting, setReporting] = useState(false)

  const { data: seller } = useQuery({
    queryKey: listing ? queryKeys.profile.detail(listing.user_id) : ['profile', 'none'],
    queryFn: () => fetchPublicProfile(listing!.user_id),
    enabled: Boolean(listing?.user_id),
  })

  const { data: favoriteCount } = useFavoriteCount(id ?? '')
  const { data: listingOffers, isLoading: offersLoading } = useListingOffers(id)
  const { data: sellerTiers } = usePublicTiers(listing ? [listing.user_id] : [])
  const { user } = useAuth()
  const navigate = useNavigate()
  const getOrCreateConversation = useGetOrCreateConversation()

  // Una visita por anuncio cargado.
  useEffect(() => {
    if (id) void incrementListingViews(id)
  }, [id])

  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </section>
    )
  }

  if (!listing) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Anuncio no encontrado</h1>
        <p className="mt-2 text-muted-foreground">Puede que se haya vendido o retirado.</p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/explorar">Volver a explorar</Link>
        </Button>
      </section>
    )
  }

  const brandName = listing.brand_id ? brands?.find((b) => b.id === listing.brand_id)?.name : null
  const categoryName = listing.category_id
    ? categories?.find((c) => c.id === listing.category_id)?.name
    : null
  const sellerName = seller?.display_name || seller?.username || 'Vendedor'
  const isOwner = user?.id === listing.user_id
  const decalsOk = listing.decals === 'perfect'
  const memberSince = seller?.created_at ? new Date(seller.created_at).getFullYear() : null

  const ConditionIcon =
    listing.condition === 'sealed' ? Package : listing.condition === 'opened' ? PackageOpen : Package

  async function handleContact() {
    if (!user) {
      navigate('/auth')
      return
    }
    const conversationId = await getOrCreateConversation.mutateAsync(listing!.id)
    navigate(`/mensajes/${conversationId}`)
  }

  async function handleShare() {
    await navigator.clipboard.writeText(window.location.href)
    setShared(true)
    setTimeout(() => setShared(false), 2000)
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Miga de pan */}
      <nav aria-label="Miga de pan" className="mb-6 flex flex-wrap items-center gap-1 text-sm">
        <Link to="/" className="text-muted-foreground hover:text-primary">
          Inicio
        </Link>
        <ChevronRight className="size-4 text-muted-foreground" />
        <Link to="/explorar" className="text-muted-foreground hover:text-primary">
          Explorar
        </Link>
        {categoryName && (
          <>
            <ChevronRight className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">{categoryName}</span>
          </>
        )}
        <ChevronRight className="size-4 text-muted-foreground" />
        <span className="min-w-0 truncate font-medium text-foreground">{listing.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Galería */}
        <div>
          <div className={cn(panel, 'aspect-[4/3]')}>
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
            <ConditionBadge condition={listing.condition} className="absolute right-3 top-3" />
            {listing.photos.length > 1 && (
              <span className="mm-mono absolute bottom-3 left-3 rounded-md border border-border bg-card/90 px-2 py-0.5 text-xs">
                {activePhoto + 1} / {listing.photos.length}
              </span>
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
                    'size-16 overflow-hidden rounded-md border-2 transition-colors',
                    i === activePhoto ? 'border-primary' : 'border-border hover:border-primary/50',
                  )}
                  aria-label={`Foto ${i + 1}`}
                  aria-current={i === activePhoto}
                >
                  <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalle */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {listing.scale && <ScaleTag scale={listing.scale} />}
            <span className="mm-mono text-xs text-muted-foreground">Ref: {listing.ref_number}</span>
          </div>

          {brandName && (
            <p className="mm-mono text-sm uppercase tracking-wider text-muted-foreground">
              {brandName}
            </p>
          )}
          <h1 className="text-balance text-3xl font-extrabold leading-tight tracking-tight">
            {listing.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <FavoriteButton listingId={listing.id} />
              <span className="text-sm text-muted-foreground">{favoriteCount ?? 0}</span>
            </div>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
            >
              <Share2 className="size-4" />
              {shared ? 'Enlace copiado' : 'Compartir'}
            </button>
            {!isOwner && (
              <button
                type="button"
                onClick={() => setReporting(true)}
                className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-destructive"
              >
                <Flag className="size-4" />
                Reportar
              </button>
            )}
          </div>

          {/* Fila de confianza */}
          <div className={cn(panel, 'hover:border-primary/50')}>
            <div className="p-4">
              <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
                <TrustCell
                  Icon={ConditionIcon}
                  tone="bg-sealed/10 text-sealed"
                  title={CONDITION_LABELS[listing.condition]}
                >
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {CONDITION_DESCRIPTIONS[listing.condition]}
                  </p>
                </TrustCell>

                <TrustCell
                  Icon={decalsOk ? CircleCheck : CircleSlash}
                  tone={decalsOk ? 'bg-sealed/10 text-sealed' : 'bg-started/10 text-started'}
                  title={`Calcas: ${DECALS_LABELS[listing.decals]}`}
                >
                  {decalsOk && (
                    <span className="mt-1 inline-flex items-center rounded-md border-2 border-sealed bg-sealed/10 px-2.5 py-0.5 text-[10px] font-semibold text-sealed">
                      OK
                    </span>
                  )}
                </TrustCell>

                {listing.shipping_inpost ? (
                  <TrustCell Icon={Truck} tone="bg-sealed/10 text-sealed" title="Envío disponible">
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Puede enviar el producto
                    </p>
                  </TrustCell>
                ) : (
                  <TrustCell
                    Icon={Handshake}
                    tone="bg-opened/10 text-opened"
                    title="Entrega en mano"
                  >
                    <p className="mt-0.5 text-xs text-muted-foreground">Solo entrega presencial</p>
                  </TrustCell>
                )}
              </div>
            </div>
          </div>

          {/* Precio */}
          <div className={cn(panel, 'hover:border-primary hover:shadow-lg hover:shadow-primary/10')}>
            <div className="absolute right-0 top-0 size-20 rounded-bl-[3rem] bg-primary/5 transition-colors duration-300 group-hover:bg-primary/10" />
            <div className="relative z-10 p-6">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Precio</p>
                  <p className="mm-mono text-4xl font-bold text-foreground transition-colors duration-300 group-hover:text-primary">
                    {formatPriceShort(listing.price_cents, listing.currency)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {new Date(listing.created_at).toLocaleDateString('es-ES')}
                  </p>
                  <p className="text-xs text-muted-foreground">{listing.views} visitas</p>
                </div>
              </div>

              {isOwner ? (
                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link to={`/anuncio/${listing.id}/editar`}>Editar mi anuncio</Link>
                </Button>
              ) : offering ? (
                <OfferForm
                  listingId={listing.id}
                  suggestedAmountEuros={listing.price_cents / 100}
                  onSent={() => setOffering(false)}
                />
              ) : (
                <Button
                  variant="accent"
                  size="lg"
                  className="w-full"
                  onClick={() => (user ? setOffering(true) : navigate('/auth'))}
                >
                  <Send />
                  Enviar oferta
                </Button>
              )}
            </div>
          </div>

          {/* Ofertas: el dueño ve las recibidas; quien oferta, la suya. La RLS decide. */}
          <OffersPanel offers={listingOffers} isLoading={offersLoading} canRespond={isOwner} />

          {/* Descripción */}
          {listing.description && (
            <div className={cn(panel, 'hover:border-primary/50')}>
              <div className="p-6">
                <h2 className="mb-2 font-display text-base font-extrabold">Descripción</h2>
                <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                  {listing.description}
                </p>
              </div>
            </div>
          )}

          {/* Vendedor */}
          <div className={cn(panel, 'hover:border-primary/50')}>
            <div className="p-6">
              <h2 className="mb-4 font-display text-base font-extrabold">Vendedor</h2>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {seller?.avatar_url ? (
                    <img
                      src={seller.avatar_url}
                      alt=""
                      className="size-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary font-display text-lg font-extrabold text-primary-foreground">
                      {sellerName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{sellerName}</p>
                      <TierBadge tier={sellerTiers?.[listing.user_id]} />
                    </div>
                    {memberSince && (
                      <p className="text-xs text-muted-foreground">Desde {memberSince}</p>
                    )}
                  </div>
                </div>
                {seller?.location && (
                  <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-4 shrink-0" />
                    {seller.location}
                  </p>
                )}
              </div>

              {!isOwner && (
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={handleContact}
                  disabled={getOrCreateConversation.isPending}
                >
                  <MessageSquare />
                  Chat
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        listingId={listing.id}
        targetTitle={listing.title}
      />
    </section>
  )
}
