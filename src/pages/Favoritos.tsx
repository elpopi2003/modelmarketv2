import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useMyFavoriteListings } from '@/hooks/useFavorites'
import { useBrands } from '@/hooks/useCatalogs'
import { ProductCard, ProductCardSkeleton } from '@/components/marketplace/ProductCard'
import { Button } from '@/components/ui/button'

export default function Favoritos() {
  const { data: listings, isLoading } = useMyFavoriteListings()
  const { data: brands } = useBrands()
  const brandNames = useMemo(() => new Map((brands ?? []).map((b) => [b.id, b.name])), [brands])

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Tus favoritos</h1>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : !listings || listings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Aún no has guardado ningún anuncio.</p>
          <Button asChild className="mt-4">
            <Link to="/explorar">Explorar el catálogo</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => (
            <ProductCard
              key={listing.id}
              listing={listing}
              brandName={listing.brand_id ? brandNames.get(listing.brand_id) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  )
}
