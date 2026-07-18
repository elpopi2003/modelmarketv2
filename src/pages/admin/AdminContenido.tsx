import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Ban, ExternalLink, Package, RotateCcw, Target } from 'lucide-react'
import { useAllListings, useAllRequests, useSetContentStatus } from '@/hooks/useAdmin'
import type { Listing } from '@/lib/api/listings'
import type { Request } from '@/lib/api/requests'
import { formatPriceShort, formatRelativeTime, REQUEST_STATUS_LABELS, STATUS_LABELS } from '@/lib/format'
import { AdminNav } from '@/components/admin/AdminNav'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Tab = 'listings' | 'requests'

/** Un estado "retirado" es el que oculta el contenido al público. */
const HIDDEN_LISTING = 'archived'
const HIDDEN_REQUEST = 'closed'

function StatusPill({ label, hidden }: { label: string; hidden: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[0.7rem] font-semibold uppercase tracking-wide',
        hidden
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-sealed/30 bg-sealed/10 text-sealed-ink',
      )}
    >
      {label}
    </span>
  )
}

function ContentRow({
  title,
  subtitle,
  cover,
  link,
  statusLabel,
  hidden,
  onToggle,
  busy,
}: {
  title: string
  subtitle: string
  cover: string | null
  link: string
  statusLabel: string
  hidden: boolean
  onToggle: () => void
  busy: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border-2 border-border bg-card p-4 shadow-sm">
      <div className="size-14 shrink-0 overflow-hidden rounded-md border border-border">
        {cover ? (
          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="mm-grid-subtle grid h-full w-full place-items-center">
            <span className="mm-mono text-[0.55rem] text-muted-foreground">SIN FOTO</span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <StatusPill label={statusLabel} hidden={hidden} />
        </div>
        <Link
          to={link}
          className="inline-flex items-center gap-1.5 font-semibold text-foreground transition-colors hover:text-primary"
        >
          <span className="line-clamp-1">{title}</span>
          <ExternalLink className="size-3.5 shrink-0" />
        </Link>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <Button
        variant={hidden ? 'outline' : 'destructive'}
        size="sm"
        disabled={busy}
        onClick={onToggle}
      >
        {hidden ? (
          <>
            <RotateCcw /> Restaurar
          </>
        ) : (
          <>
            <Ban /> Retirar
          </>
        )}
      </Button>
    </div>
  )
}

export default function AdminContenido() {
  const [tab, setTab] = useState<Tab>('listings')
  const { data: listings, isLoading: loadingL } = useAllListings()
  const { data: requests, isLoading: loadingR } = useAllRequests()
  const setStatus = useSetContentStatus()

  const isLoading = tab === 'listings' ? loadingL : loadingR
  const items: (Listing | Request)[] = tab === 'listings' ? (listings ?? []) : (requests ?? [])

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <AdminNav />

      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
        <Package className="size-7" /> Contenido
      </h1>
      <p className="mt-1 text-muted-foreground">
        Todo el contenido de la plataforma, incluido el ya retirado.
      </p>

      <div className="mt-6 inline-flex rounded-lg border-2 border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setTab('listings')}
          aria-current={tab === 'listings'}
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-4 py-2 font-display text-sm font-extrabold uppercase tracking-wide transition-colors',
            tab === 'listings'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Package className="size-4" /> Anuncios ({listings?.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setTab('requests')}
          aria-current={tab === 'requests'}
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-4 py-2 font-display text-sm font-extrabold uppercase tracking-wide transition-colors',
            tab === 'requests'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Target className="size-4" /> Peticiones ({requests?.length ?? 0})
        </button>
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-lg border-2 border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No hay contenido en esta sección.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {tab === 'listings'
            ? (listings ?? []).map((l) => {
                const hidden = l.status === HIDDEN_LISTING
                return (
                  <ContentRow
                    key={l.id}
                    title={l.title}
                    subtitle={`${formatPriceShort(l.price_cents, l.currency)} · ${formatRelativeTime(l.created_at)}`}
                    cover={l.photos[0] ?? null}
                    link={`/producto/${l.id}`}
                    statusLabel={STATUS_LABELS[l.status]}
                    hidden={hidden}
                    busy={setStatus.isPending}
                    onToggle={() =>
                      setStatus.mutate({
                        kind: 'listing',
                        id: l.id,
                        status: hidden ? 'active' : HIDDEN_LISTING,
                      })
                    }
                  />
                )
              })
            : (requests ?? []).map((r) => {
                const hidden = r.status === HIDDEN_REQUEST
                return (
                  <ContentRow
                    key={r.id}
                    title={r.title}
                    subtitle={`${
                      r.max_price_cents != null ? formatPriceShort(r.max_price_cents) + ' · ' : ''
                    }${formatRelativeTime(r.created_at)}`}
                    cover={r.photos[0] ?? null}
                    link={`/peticion/${r.id}`}
                    statusLabel={REQUEST_STATUS_LABELS[r.status]}
                    hidden={hidden}
                    busy={setStatus.isPending}
                    onToggle={() =>
                      setStatus.mutate({
                        kind: 'request',
                        id: r.id,
                        status: hidden ? 'open' : HIDDEN_REQUEST,
                      })
                    }
                  />
                )
              })}
        </div>
      )}

      {setStatus.isError && (
        <p className="mt-4 text-sm text-destructive">No se pudo cambiar el estado.</p>
      )}
    </section>
  )
}
