import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useRequest } from '@/hooks/useRequests'
import { useBrands, useCategories } from '@/hooks/useCatalogs'
import { fetchPublicProfile } from '@/lib/api/profiles'
import { queryKeys } from '@/lib/queryKeys'
import {
  CONDITION_LABELS,
  DECALS_REQUIREMENT_LABELS,
  formatPrice,
  URGENCY_LABELS,
} from '@/lib/format'
import { ScaleTag } from '@/components/marketplace/ScaleTag'
import { Seo } from '@/components/seo/Seo'

export default function Peticion() {
  const { id } = useParams<{ id: string }>()
  const { data: request, isLoading } = useRequest(id)
  const { data: brands } = useBrands()
  const { data: categories } = useCategories()

  const { data: requester } = useQuery({
    queryKey: request ? queryKeys.profile.detail(request.user_id) : ['profile', 'none'],
    queryFn: () => fetchPublicProfile(request!.user_id),
    enabled: Boolean(request?.user_id),
  })

  if (isLoading) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="h-64 animate-pulse rounded-md bg-muted" />
      </section>
    )
  }

  if (!request) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <Seo title="Petición no encontrada" noindex />
        <h1 className="text-3xl font-extrabold tracking-tight">Petición no encontrada</h1>
        <p className="mt-2 text-muted-foreground">Puede que se haya cerrado o retirado.</p>
        <Link to="/peticiones" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">
          Volver a peticiones
        </Link>
      </section>
    )
  }

  const brandName = request.brand_id ? brands?.find((b) => b.id === request.brand_id)?.name : null
  const categoryName = request.category_id
    ? categories?.find((c) => c.id === request.category_id)?.name
    : null
  const requesterName = requester?.display_name || requester?.username || 'Usuario'

  const seoDescription = [
    'Se busca:',
    brandName,
    request.title,
    request.scale ? `a escala ${request.scale}` : null,
    request.max_price_cents != null ? `· hasta ${formatPrice(request.max_price_cents)}` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <Seo title={request.title} description={seoDescription} type="article" />
      <Link
        to="/peticiones"
        className="mm-mono mb-6 inline-block text-xs uppercase text-muted-foreground hover:text-accent"
      >
        ← Volver a peticiones
      </Link>

      <article className="mm-border-technical rounded-md bg-card p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="mm-mono text-xs font-semibold uppercase tracking-wide text-accent">
            Se busca
          </span>
          {request.scale && <ScaleTag scale={request.scale} />}
          {categoryName && (
            <span className="mm-mono text-xs uppercase text-muted-foreground">{categoryName}</span>
          )}
        </div>

        {brandName && (
          <p className="mm-mono mb-1 text-sm uppercase text-muted-foreground">{brandName}</p>
        )}
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-balance">
          {request.title}
        </h1>

        {request.max_price_cents != null && (
          <p className="mm-mono mt-4 text-3xl font-bold text-accent">
            Hasta {formatPrice(request.max_price_cents)}
          </p>
        )}

        {request.photos.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {request.photos.map((photo) => (
              <img
                key={photo}
                src={photo}
                alt=""
                loading="lazy"
                className="aspect-square w-full rounded-md border border-border object-cover"
              />
            ))}
          </div>
        )}

        {request.description && (
          <p className="mt-6 whitespace-pre-line leading-relaxed text-foreground">
            {request.description}
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Estados aceptados</p>
            <div className="flex flex-wrap gap-1">
              {(request.accepted_conditions ?? []).map((condition) => (
                <span
                  key={condition}
                  className="inline-flex items-center rounded-md border border-border px-2.5 py-0.5 text-xs font-semibold text-foreground"
                >
                  {CONDITION_LABELS[condition]}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Calcas</p>
            <p className="text-sm">{DECALS_REQUIREMENT_LABELS[request.decals_requirement]}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Urgencia</p>
            <p className="text-sm">{URGENCY_LABELS[request.urgency]}</p>
          </div>
        </div>

        <div className="mm-card mt-8 flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/10 font-mono text-sm font-semibold text-accent-ink">
            {requesterName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="mm-mono text-xs uppercase text-muted-foreground">Lo busca</p>
            <p className="truncate font-semibold">{requesterName}</p>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Responder a las peticiones es una función de los planes PRO y Retail. Puedes enviar tu
          oferta desde el listado de <Link to="/peticiones" className="underline underline-offset-2">peticiones</Link>.
        </p>
      </article>
    </section>
  )
}
