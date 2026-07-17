import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useListings } from '@/hooks/useListings'
import { useBrands, useCategories } from '@/hooks/useCatalogs'
import { fetchPublicProfiles } from '@/lib/api/profiles'
import { queryKeys } from '@/lib/queryKeys'
import { ProductCard, ProductCardSkeleton } from '@/components/marketplace/ProductCard'
import { CONDITION_LABELS } from '@/lib/format'
import type { ListingFilters, ListingSort } from '@/lib/api/listings'
import type { ListingCondition } from '@/integrations/supabase/types'
import { Input } from '@/components/ui/input'

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

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

  const { data: listings, isLoading } = useListings(filters)
  const { data: brands } = useBrands()
  const { data: categories } = useCategories()

  // Soporta llegar con ?cat=<slug> (tarjetas de categoría de la home).
  const [searchParams] = useSearchParams()
  const catSlug = searchParams.get('cat')
  useEffect(() => {
    if (!catSlug || !categories) return
    const match = categories.find((c) => c.slug === catSlug)
    if (match) setCategoryId(match.id)
  }, [catSlug, categories])

  const brandNames = useMemo(
    () => new Map((brands ?? []).map((b) => [b.id, b.name])),
    [brands],
  )
  const ownerIds = useMemo(() => (listings ?? []).map((l) => l.user_id), [listings])
  const { data: sellers } = useQuery({
    queryKey: [...queryKeys.profile.all, 'list', ownerIds],
    queryFn: () => fetchPublicProfiles(ownerIds),
    enabled: ownerIds.length > 0,
  })
  const sellerById = useMemo(() => new Map((sellers ?? []).map((s) => [s.id, s])), [sellers])

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
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
      ) : !listings || listings.length === 0 ? (
        <div className="mm-border-technical rounded-md p-12 text-center">
          <p className="text-muted-foreground">No hay anuncios que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => {
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
        </div>
      )}
    </section>
  )
}
