import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Car,
  CircleCheck,
  Package,
  Paintbrush,
  Plane,
  Rocket,
  Ship,
  Shield,
  Target,
  TrainFront,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import heroUrl from '@/assets/hero-background.png'
import { useAuth } from '@/hooks/useAuth'
import { useListings } from '@/hooks/useListings'
import { useRequests } from '@/hooks/useRequests'
import { useBrands, useCategories } from '@/hooks/useCatalogs'
import { fetchPublicProfiles } from '@/lib/api/profiles'
import { queryKeys } from '@/lib/queryKeys'
import type { Request } from '@/lib/api/requests'
import { ProductCard } from '@/components/marketplace/ProductCard'
import { RequestCard } from '@/components/marketplace/RequestCard'
import { RequestDialog } from '@/components/marketplace/RequestDialog'
import { Button } from '@/components/ui/button'
import { Seo } from '@/components/seo/Seo'

/** Icono y descripción de cada categoría del catálogo, por slug. */
const CATEGORY_META: Record<string, { Icon: LucideIcon; description: string }> = {
  'aviacion': { Icon: Plane, description: 'Aviones, helicópteros y aeronaves' },
  'vehiculos-militares': { Icon: Shield, description: 'Tanques, vehículos blindados y artillería' },
  'automoviles': { Icon: Car, description: 'Coches, motos y vehículos de calle' },
  'barcos': { Icon: Ship, description: 'Barcos, submarinos y embarcaciones' },
  'trenes': { Icon: TrainFront, description: 'Locomotoras, vagones y ferrocarril' },
  'figuras': { Icon: Users, description: 'Figuras y miniaturas a escala' },
  'ciencia-ficcion': { Icon: Rocket, description: 'Naves, mechas y universos de ficción' },
  'pinturas-accesorios': { Icon: Paintbrush, description: 'Pinturas, herramientas y accesorios' },
}

function Kicker({ children }: { children: string }) {
  return (
    <span className="mm-mono inline-block rounded-md border border-border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  )
}

/** Landing pública. Se carga de forma eager (es la home). */
export default function Index() {
  const { user } = useAuth()
  const { data: listings } = useListings({ sort: 'recent' })
  const { data: requests } = useRequests({ sort: 'recent' })
  const { data: categories } = useCategories()
  const { data: brands } = useBrands()
  const [selected, setSelected] = useState<Request | null>(null)

  const featured = (listings ?? []).slice(0, 4)
  const activeRequests = (requests ?? []).slice(0, 2)

  const countByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const listing of listings ?? []) {
      if (listing.category_id) map.set(listing.category_id, (map.get(listing.category_id) ?? 0) + 1)
    }
    return map
  }, [listings])

  const brandNames = useMemo(() => new Map((brands ?? []).map((b) => [b.id, b.name])), [brands])
  const categoryNames = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c.name])),
    [categories],
  )

  const peopleIds = useMemo(() => {
    const ids = [
      ...(featured.map((l) => l.user_id) ?? []),
      ...(activeRequests.map((r) => r.user_id) ?? []),
    ]
    return [...new Set(ids)]
  }, [featured, activeRequests])

  const { data: people } = useQuery({
    queryKey: [...queryKeys.profile.all, 'list', peopleIds],
    queryFn: () => fetchPublicProfiles(peopleIds),
    enabled: peopleIds.length > 0,
  })
  const personById = useMemo(() => new Map((people ?? []).map((p) => [p.id, p])), [people])
  const nameOf = (userId: string) => {
    const p = personById.get(userId)
    return p?.display_name || p?.username || undefined
  }

  return (
    <>
      <Seo
        title="ModelMarket — Maquetas y modelos a escala"
        titleExact
        description="Marketplace de maquetas y modelos a escala con 0% de comisión entre coleccionistas. Compra, vende y encuentra esa pieza descatalogada."
      />
      {/* Hero — colores sobre fotografía: independientes del tema a propósito */}
      <section className="relative overflow-hidden">
        <img
          src={heroUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6 sm:py-32">
          <span className="mm-mono mb-6 inline-flex items-center gap-2 rounded-full border border-accent/60 bg-black/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
            <Zap className="size-3.5" /> 0% comisión por venta
          </span>

          <h1 className="text-balance text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
            El marketplace para{' '}
            <span className="mm-underline-accent text-accent">coleccionistas</span> de modelismo
          </h1>

          <p className="mt-6 max-w-2xl text-pretty text-lg text-white/85">
            Compra, vende y encuentra maquetas descatalogadas. Filtros de escala, marca y estado.
            Sin intermediarios, sin comisiones.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="accent" size="lg">
              <Link to="/explorar">
                Explorar catálogo <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="border-2 border-white/70 bg-transparent text-white hover:bg-white/10"
            >
              <Link to="/publicar">Publicar gratis</Link>
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/85">
            <span className="inline-flex items-center gap-1.5">
              <CircleCheck className="size-4 text-sealed" /> Vendedores verificados
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Shield className="size-4" /> Chat seguro
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Target className="size-4 text-accent" /> {listings?.length ?? 0}{' '}
              {listings?.length === 1 ? 'maqueta' : 'maquetas'}
            </span>
          </div>
        </div>
      </section>

      {/* Categorías */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Kicker>Categorías</Kicker>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Explora por Tipo</h2>
        <p className="mt-1 text-muted-foreground">Encuentra maquetas organizadas por categoría</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(categories ?? []).map((category) => {
            const meta = CATEGORY_META[category.slug] ?? {
              Icon: Package,
              description: 'Maquetas y modelos a escala',
            }
            const count = countByCategory.get(category.id) ?? 0
            return (
              <Link
                key={category.id}
                to={`/explorar?cat=${category.slug}`}
                className="group relative overflow-hidden rounded-lg border-2 border-border bg-card p-5 shadow-sm transition-all duration-300 hover:border-primary hover:shadow-lg hover:shadow-primary/10"
              >
                <div className="absolute right-0 top-0 size-16 rounded-bl-[2.5rem] bg-muted/60 transition-colors duration-300 group-hover:bg-primary/10" />
                <div className="relative flex items-start justify-between gap-2">
                  <span className="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110 motion-reduce:transform-none">
                    <meta.Icon className="size-5" />
                  </span>
                  <span className="mm-mono text-xs text-muted-foreground">
                    {count} {count === 1 ? 'anuncio' : 'anuncios'}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold text-foreground transition-colors group-hover:text-primary">
                  {category.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Productos destacados */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Kicker>Novedades</Kicker>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Productos Destacados</h2>
              <p className="mt-1 text-muted-foreground">
                Las últimas maquetas añadidas al marketplace
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/explorar">
                Ver todos <ArrowRight />
              </Link>
            </Button>
          </div>

          {featured.length > 0 ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((listing) => {
                const seller = personById.get(listing.user_id)
                return (
                  <ProductCard
                    key={listing.id}
                    listing={listing}
                    brandName={listing.brand_id ? brandNames.get(listing.brand_id) : undefined}
                    sellerName={nameOf(listing.user_id)}
                    sellerAvatarUrl={seller?.avatar_url}
                    shippingAvailable={listing.shipping_inpost}
                    reserved={listing.status === 'reserved'}
                  />
                )
              })}
            </div>
          ) : (
            <p className="mt-8 rounded-lg border-2 border-dashed border-border p-10 text-center text-muted-foreground">
              Aún no hay anuncios publicados. Sé el primero.
            </p>
          )}
        </div>
      </section>

      {/* Peticiones activas */}
      <section className="mm-grid-subtle">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Kicker>Buscados</Kicker>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Peticiones Activas</h2>
              <p className="mt-1 max-w-md text-muted-foreground">
                ¿Tienes una maqueta descatalogada? Los compradores buscan activamente estos kits.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/peticiones">
                Ver todas <ArrowRight />
              </Link>
            </Button>
          </div>

          {activeRequests.length > 0 ? (
            <div className="mt-8 space-y-4">
              {activeRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  brandName={request.brand_id ? brandNames.get(request.brand_id) : undefined}
                  authorName={nameOf(request.user_id)}
                  authorLocation={personById.get(request.user_id)?.location}
                  isOwn={request.user_id === user?.id}
                  onOpen={() => setSelected(request)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-8 rounded-lg border-2 border-dashed border-border bg-card p-10 text-center text-muted-foreground">
              No hay peticiones abiertas ahora mismo.
            </p>
          )}

          <div className="mt-8 text-center">
            <Button asChild variant="accent">
              <Link to="/crear-peticion">
                <Target /> Publicar petición <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-primary">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-balance text-3xl font-extrabold tracking-tight text-primary-foreground">
            ¿Listo para vender sin comisiones?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            Únete a los coleccionistas que ya venden sus maquetas sin perder un euro en comisiones.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="accent" size="lg">
              <Link to={user ? '/publicar' : '/auth'}>
                {user ? 'Publicar anuncio' : 'Crear cuenta gratis'}
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="border-2 border-primary-foreground/60 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link to="/precios">Ver planes PRO</Link>
            </Button>
          </div>
        </div>
      </section>

      <RequestDialog
        request={selected}
        brandName={selected?.brand_id ? brandNames.get(selected.brand_id) : undefined}
        categoryName={selected?.category_id ? categoryNames.get(selected.category_id) : undefined}
        authorName={selected ? nameOf(selected.user_id) : undefined}
        authorLocation={selected ? personById.get(selected.user_id)?.location : undefined}
        onClose={() => setSelected(null)}
      />
    </>
  )
}
