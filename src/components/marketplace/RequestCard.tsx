import { Link } from 'react-router-dom'
import type { Request } from '@/lib/api/requests'
import { formatPrice } from '@/lib/format'
import { ScaleTag } from './ScaleTag'

/** Tarjeta de petición ("se busca") — borde dashed 2px + acento naranja (design system). */
export function RequestCard({
  request,
  categoryName,
  brandName,
}: {
  request: Request
  categoryName?: string
  brandName?: string
}) {
  const meta = [brandName, categoryName].filter(Boolean).join(' · ')

  return (
    <Link
      to={`/peticion/${request.id}`}
      className="mm-border-technical group block rounded-md bg-card p-5 transition-[border-color,box-shadow] duration-300 hover:border-accent hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="mm-mono text-xs font-semibold uppercase tracking-wide text-accent">
              Se busca
            </span>
            {request.scale && <ScaleTag scale={request.scale} />}
          </div>

          <h3 className="text-lg font-semibold leading-snug transition-colors group-hover:text-accent">
            {request.title}
          </h3>

          {request.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{request.description}</p>
          )}

          {meta && <p className="mm-mono mt-2 text-xs uppercase text-muted-foreground">{meta}</p>}
        </div>

        {request.max_price_cents != null && (
          <div className="shrink-0 text-right">
            <p className="mm-mono text-xs text-muted-foreground">Hasta</p>
            <p className="mm-mono text-2xl font-bold text-accent">
              {formatPrice(request.max_price_cents)}
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}
