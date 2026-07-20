import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pageWindow } from '@/hooks/usePagination'
import { cn } from '@/lib/utils'

/** Controles de paginación. El llamante decide si mostrarlos (`needsPagination`). */
export function Pagination({
  page,
  totalPages,
  onGoTo,
  label,
}: {
  page: number
  totalPages: number
  onGoTo: (page: number) => void
  /** Para el `aria-label`, que distingue una paginación de otra en la misma página. */
  label: string
}) {
  const pages = pageWindow(page, totalPages)

  return (
    <nav aria-label={label} className="mt-8 flex items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onGoTo(page - 1)}
        disabled={page === 1}
        aria-label="Página anterior"
        className="inline-flex size-9 items-center justify-center rounded-md border-2 border-border bg-card text-foreground transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft className="size-4" />
      </button>

      {pages.map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} aria-hidden className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onGoTo(p)}
            aria-label={`Página ${p}`}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'mm-mono inline-flex size-9 items-center justify-center rounded-md border-2 text-sm font-bold transition-colors',
              p === page
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:border-primary hover:text-primary',
            )}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onGoTo(page + 1)}
        disabled={page === totalPages}
        aria-label="Página siguiente"
        className="inline-flex size-9 items-center justify-center rounded-md border-2 border-border bg-card text-foreground transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  )
}
