import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDeleteListing, useListings, useMyListings, useUpdateListing } from '@/hooks/useListings'
import { useAuth } from '@/hooks/useAuth'
import { usePagination } from '@/hooks/usePagination'
import { filterOwnListings } from '@/lib/localFilters'
import { Pagination } from '@/components/ui/pagination'
import { SectionHeading } from '@/components/marketplace/SectionHeading'
import { useBrands, useCategories } from '@/hooks/useCatalogs'
import { fetchPublicProfiles } from '@/lib/api/profiles'
import { queryKeys } from '@/lib/queryKeys'
import { ProductCard, ProductCardSkeleton } from '@/components/marketplace/ProductCard'
import { CONDITION_LABELS } from '@/lib/format'
import type { ListingFilters, ListingSort } from '@/lib/api/listings'
import type { ListingCondition } from '@/integrations/supabase/types'
import { Input } from '@/components/ui/input'
import { Seo } from '@/components/seo/Seo'

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function ListingGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
}

export default function Explorar() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [condition, setCondition] = useState<'' | ListingCondition>('')
  const [sort, setSort] = useState<ListingSort>('recent')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const filters: ListingFilters = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      condition: condition || undefined,
      sort,
    }),
    [debouncedSearch, categoryId, brandId, condition, sort],
  )

  const { user } = useAuth()
  const { data: listings, isLoading } = useListings(filters)
  // Los propios vienen de su propia consulta: el catálogo público solo trae activos y
  // reservados, así que desde ahí no se podría ver ni reactivar uno suspendido.
  const { data: myListings } = useMyListings()
  const { data: brands } = useBrands()
  const { data: categories } = useCategories()
  const deleteListing = useDeleteListing()
  const updateListing = useUpdateListing()

  const ownListings = useMemo(
    () => (user ? filterOwnListings(myListings ?? [], filters) : []),
    [myListings, filters, user],
  )
  // Se excluyen los propios del catálogo general para no verlos dos veces.
  const otherListings = useMemo(
    () => (listings ?? []).filter((l) => l.user_id !== user?.id),
    [listings, user?.id],
  )

  const ownPage = usePagination(ownListings)
  const othersPage = usePagination(otherListings)
  const busy = deleteListing.isPending || updateListing.isPending

  // Soporta llegar con ?cat=<slug> (tarjetas de categoría de la home).
  const [searchParams] = useSearchParams()
  const catSlug = searchParams.get('cat')
  useEffect(() => {
    if (!catSlug || !categories) return
    const match = categories.find((c) => c.slug === catSlug)
    if (match) setCategoryId(match.id)
  }, [catSlug, categories])

  const brandNames = useMemo(() => new Map((brands ?? []).map((b) => [b.id, b.name])), [brands])
  // Incluye al propio usuario: sus anuncios ya no salen del catálogo general.
  const ownerIds = useMemo(
    () => [...new Set([...(listings ?? []).map((l) => l.user_id), ...(user ? [user.id] : [])])],
    [listings, user],
  )
  const { data: sellers } = useQuery({
    queryKey: [...queryKeys.profile.all, 'list', ownerIds],
    queryFn: () => fetchPublicProfiles(ownerIds),
    enabled: ownerIds.length > 0,
  })
  const sellerById = useMemo(() => new Map((sellers ?? []).map((s) => [s.id, s])), [sellers])

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <Seo
        title="Explorar anuncios"
        description="Explora maquetas y modelos a escala en venta: militares, aviación, barcos, coches, figuras y más. 0% de comisión entre coleccionistas."
      />
      <div className="mm-section-header">
        <span className="mm-section-header__label">Catálogo</span>
      </div>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight sm:text-4xl">Explorar anuncios</h1>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          placeholder="Buscar maquetas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:col-span-2 lg:col-span-1"
        />
        <select
          className={selectClass}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Categoría"
        >
          <option value="">Todas las categorías</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          aria-label="Marca"
        >
          <option value="">Todas las marcas</option>
          {brands?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={condition}
          onChange={(e) => setCondition(e.target.value as '' | ListingCondition)}
          aria-label="Estado"
        >
          <option value="">Cualquier estado</option>
          {Object.entries(CONDITION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={sort}
          onChange={(e) => setSort(e.target.value as ListingSort)}
          aria-label="Ordenar"
        >
          <option value="recent">Más recientes</option>
          <option value="price_asc">Precio: menor a mayor</option>
          <option value="price_desc">Precio: mayor a menor</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : ownListings.length === 0 && otherListings.length === 0 ? (
        <div className="mm-border-technical rounded-md p-12 text-center">
          <p className="text-muted-foreground">No hay anuncios que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <>
          {ownListings.length > 0 && (
            <section className="mb-10">
              <SectionHeading
                title="Tus anuncios"
                count={ownListings.length}
                singular="anuncio"
                plural="anuncios"
              />
              <ListingGrid>
                {ownPage.visible.map((listing) => {
                  const seller = sellerById.get(listing.user_id)
                  return (
                    <ProductCard
                      key={listing.id}
                      listing={listing}
                      brandName={listing.brand_id ? brandNames.get(listing.brand_id) : undefined}
                      sellerName={seller?.display_name || seller?.username || undefined}
                      sellerAvatarUrl={seller?.avatar_url}
                      shippingAvailable={listing.shipping_inpost}
                      reserved={listing.status === 'reserved'}
                      isOwn
                      busy={busy}
                      onDelete={() => deleteListing.mutate(listing.id)}
                      onToggleSuspend={() =>
                        updateListing.mutate({
                          id: listing.id,
                          updates: {
                            status: listing.status === 'archived' ? 'active' : 'archived',
                          },
                        })
                      }
                    />
                  )
                })}
              </ListingGrid>
              {ownPage.needsPagination && (
                <Pagination
                  page={ownPage.page}
                  totalPages={ownPage.totalPages}
                  onGoTo={ownPage.goTo}
                  label="Paginación de tus anuncios"
                />
              )}
            </section>
          )}

          {otherListings.length > 0 && (
            <section>
              <SectionHeading
                title={ownListings.length > 0 ? 'Todos los anuncios' : 'Anuncios'}
                count={otherListings.length}
                singular="anuncio"
                plural="anuncios"
              />
              <ListingGrid>
                {othersPage.visible.map((listing) => {
                  const seller = sellerById.get(listing.user_id)
                  return (
                    <ProductCard
                      key={listing.id}
                      listing={listing}
                      brandName={listing.brand_id ? brandNames.get(listing.brand_id) : undefined}
                      sellerName={seller?.display_name || seller?.username || undefined}
                      sellerAvatarUrl={seller?.avatar_url}
                      shippingAvailable={listing.shipping_inpost}
                      reserved={listing.status === 'reserved'}
                    />
                  )
                })}
              </ListingGrid>
              {othersPage.needsPagination && (
                <Pagination
                  page={othersPage.page}
                  totalPages={othersPage.totalPages}
                  onGoTo={othersPage.goTo}
                  label="Paginación de todos los anuncios"
                />
              )}
            </section>
          )}
        </>
      )}
    </section>
  )
}
