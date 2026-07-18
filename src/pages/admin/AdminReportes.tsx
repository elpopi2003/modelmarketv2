import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Ban, Check, ExternalLink, Flag, X } from 'lucide-react'
import { useReports, useResolveReport } from '@/hooks/useAdmin'
import type { ReportListItem } from '@/lib/api/reports'
import type { ReportStatus } from '@/integrations/supabase/types'
import {
  formatRelativeTime,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
} from '@/lib/format'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TABS: { value: ReportStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'resolved', label: 'Resueltas' },
  { value: 'dismissed', label: 'Descartadas' },
  { value: 'all', label: 'Todas' },
]

const STATUS_STYLES: Record<ReportStatus, string> = {
  pending: 'bg-started/10 text-started-ink border-started/30',
  resolved: 'bg-sealed/10 text-sealed-ink border-sealed/30',
  dismissed: 'bg-muted text-muted-foreground border-border',
}

const TARGET_LABELS = { listing: 'Anuncio', request: 'Petición', user: 'Usuario' } as const

function ReportRow({ item }: { item: ReportListItem }) {
  const resolve = useResolveReport()
  const { report } = item
  const isPending = report.status === 'pending'
  const canTakeDown = item.targetKind !== 'user'

  return (
    <div className="rounded-lg border-2 border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="mm-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">
              {TARGET_LABELS[item.targetKind]}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[0.7rem] font-semibold uppercase tracking-wide',
                STATUS_STYLES[report.status],
              )}
            >
              {REPORT_STATUS_LABELS[report.status]}
            </span>
          </div>

          {item.targetLink ? (
            <Link
              to={item.targetLink}
              className="inline-flex items-center gap-1.5 font-semibold text-foreground transition-colors hover:text-primary"
            >
              {item.targetTitle} <ExternalLink className="size-3.5" />
            </Link>
          ) : (
            <p className="font-semibold text-foreground">{item.targetTitle}</p>
          )}

          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-destructive">
              {REPORT_REASON_LABELS[report.reason]}
            </span>{' '}
            · denunciado por {item.reporterName} · {formatRelativeTime(report.created_at)}
          </p>

          {report.details && (
            <p className="mt-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              “{report.details}”
            </p>
          )}

          {report.resolution_note && (
            <p className="mt-2 text-xs text-muted-foreground">Nota: {report.resolution_note}</p>
          )}
        </div>
      </div>

      {isPending && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canTakeDown && (
            <Button
              variant="destructive"
              size="sm"
              disabled={resolve.isPending}
              onClick={() =>
                resolve.mutate({
                  reportId: report.id,
                  status: 'resolved',
                  note: 'Contenido retirado',
                  takeDown: {
                    kind: item.targetKind as 'listing' | 'request',
                    id: (report.listing_id ?? report.request_id)!,
                  },
                })
              }
            >
              <Ban /> Retirar contenido
            </Button>
          )}
          <Button
            size="sm"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate({ reportId: report.id, status: 'resolved' })}
          >
            <Check /> Marcar resuelta
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate({ reportId: report.id, status: 'dismissed' })}
          >
            <X /> Descartar
          </Button>
        </div>
      )}

      {resolve.isError && (
        <p className="mt-2 text-sm text-destructive">No se pudo completar la acción.</p>
      )}
    </div>
  )
}

export default function AdminReportes() {
  const [tab, setTab] = useState<ReportStatus | 'all'>('pending')
  const { data: items, isLoading } = useReports(tab === 'all' ? undefined : tab)

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        to="/admin"
        className="mb-6 inline-flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide text-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4" /> Administración
      </Link>

      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
        <Flag className="size-7" /> Moderación
      </h1>
      <p className="mt-1 text-muted-foreground">
        Denuncias enviadas por la comunidad sobre anuncios, peticiones y usuarios.
      </p>

      <div className="mt-6 inline-flex flex-wrap rounded-lg border-2 border-border bg-card p-1">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-current={tab === value}
            className={cn(
              'rounded-md px-4 py-2 font-display text-sm font-extrabold uppercase tracking-wide transition-colors',
              tab === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="mt-6 rounded-lg border-2 border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">
            {tab === 'pending'
              ? 'No hay denuncias pendientes. Todo en orden.'
              : 'No hay denuncias en esta bandeja.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <ReportRow key={item.report.id} item={item} />
          ))}
        </div>
      )}
    </section>
  )
}
