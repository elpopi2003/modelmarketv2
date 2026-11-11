import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Ban,
  ExternalLink,
  Package,
  RotateCcw,
  Search,
  Target,
  Trash2,
  UserRound,
} from 'lucide-react'
import {
  useAdminUsers,
  useAllListings,
  useAllRequests,
  useDeleteListingAsAdmin,
  useDeleteRequestAsAdmin,
  useSetContentStatus,
} from '@/hooks/useAdmin'
import type { Listing } from '@/lib/api/listings'
import type { Request } from '@/lib/api/requests'
import {
  formatPriceShort,
  formatRelativeTime,
  REQUEST_STATUS_LABELS,
  STATUS_LABELS,
} from '@/lib/format'
import { AdminNav } from '@/components/admin/AdminNav'
import { ListingBulkBar } from '@/components/admin/ListingBulkBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, matchesSearch } from '@/lib/utils'

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
  restoreTo,
  onToggle,
  onDelete,
  busy,
  selection,
}: {
  title: string
  subtitle: string
  cover: string | null
  link: string
  statusLabel: string
  hidden: boolean
  /** Estado al que volverá si se restaura (null = no consta). */
  restoreTo: string | null
  onToggle: () => void
  /** Borrado definitivo. Solo se pasa cuando la acción está disponible. */
  onDelete?: () => void
  busy: boolean
  /** Casilla del selector múltiple (solo en anuncios). */
  selection?: { checked: boolean; onChange: (checked: boolean) => void }
}) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-4 rounded-lg border-2 bg-card p-4 shadow-sm transition-colors',
        selection?.checked ? 'border-primary bg-primary/[0.04]' : 'border-border',
      )}
    >
      {selection && (
        <input
          type="checkbox"
          className="size-4 shrink-0 rounded border-input accent-primary"
          checked={selection.checked}
          onChange={(e) => selection.onChange(e.target.checked)}
          aria-label={`Seleccionar «${title}»`}
        />
      )}
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
        {hidden && restoreTo && (
          <p className="mm-mono mt-1 text-xs text-muted-foreground">
            Se restaurará como: {restoreTo}
          </p>
        )}
      </div>

      {confirming ? (
        <div className="flex w-full flex-col gap-2 rounded-md border-2 border-destructive/60 bg-destructive/10 p-3 sm:w-auto">
          <p className="text-sm font-semibold text-destructive">¿Eliminar definitivamente?</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Se borrarán también sus ofertas, conversaciones y los reportes asociados. No se puede
            deshacer.
          </p>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" disabled={busy} onClick={onDelete}>
              Sí, eliminar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
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

          {/* Solo se ofrece sobre contenido ya retirado: retirar es reversible, esto no. */}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setConfirming(true)}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              <Trash2 /> Eliminar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminContenido() {
  const [tab, setTab] = useState<Tab>('listings')
  const [search, setSearch] = useState('')
  /** Propietario por el que se filtran los anuncios ('' = todos). */
  const [owner, setOwner] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const { data: listings, isLoading: loadingL } = useAllListings()
  const { data: users } = useAdminUsers()
  const { data: requests, isLoading: loadingR } = useAllRequests()
  const setStatus = useSetContentStatus()
  const deleteRequest = useDeleteRequestAsAdmin()
  const deleteListing = useDeleteListingAsAdmin()

  const isLoading = tab === 'listings' ? loadingL : loadingR

  const userName = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of users ?? []) m.set(u.id, u.display_name || u.username || u.email)
    return m
  }, [users])

  // Propietarios con anuncios, para el selector (con cuántos tiene cada uno).
  const owners = useMemo(() => {
    const count = new Map<string, number>()
    for (const l of listings ?? []) count.set(l.user_id, (count.get(l.user_id) ?? 0) + 1)
    return [...count]
      .map(([id, n]) => ({ id, n, name: userName.get(id) ?? 'Cuenta sin nombre' }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [listings, userName])

  // Se filtra por propietario y por título, estado o dueño: así se localiza «lo retirado».
  const listingsFiltrados = useMemo(
    () =>
      (listings ?? []).filter(
        (l) =>
          (!owner || l.user_id === owner) &&
          matchesSearch(search, [l.title, STATUS_LABELS[l.status], userName.get(l.user_id)]),
      ),
    [listings, search, owner, userName],
  )
  // Solo cuenta lo seleccionado que se ve con los filtros actuales.
  const selectedIds = listingsFiltrados.filter((l) => selected.has(l.id)).map((l) => l.id)
  const allSelected =
    listingsFiltrados.length > 0 && selectedIds.length === listingsFiltrados.length
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  const clearSelection = () => setSelected(new Set())
  const requestsFiltradas = useMemo(
    () =>
      (requests ?? []).filter((r) =>
        matchesSearch(search, [r.title, REQUEST_STATUS_LABELS[r.status]]),
      ),
    [requests, search],
  )
  const items: (Listing | Request)[] = tab === 'listings' ? listingsFiltrados : requestsFiltradas

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
          onClick={() => (setTab('listings'), clearSelection())}
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
          onClick={() => (setTab('requests'), clearSelection())}
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

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          className="pl-9"
          placeholder="Buscar por título o estado (p. ej. «archivado»)…"
          aria-label="Buscar contenido"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {tab === 'listings' && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm sm:max-w-sm">
            <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <select
              className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={owner}
              onChange={(e) => (setOwner(e.target.value), clearSelection())}
              aria-label="Filtrar por propietario"
            >
              <option value="">Todos los propietarios</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.n})
                </option>
              ))}
            </select>
          </label>
          {listingsFiltrados.length > 0 && (
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-primary"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = selectedIds.length > 0 && !allSelected
                }}
                onChange={(e) =>
                  setSelected(
                    e.target.checked ? new Set(listingsFiltrados.map((l) => l.id)) : new Set(),
                  )
                }
              />
              {listingsFiltrados.length === 1
                ? 'Seleccionar el anuncio mostrado'
                : `Seleccionar los ${listingsFiltrados.length} mostrados`}
            </label>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-lg border-2 border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">
            {search
              ? `Nada coincide con «${search}» en esta pestaña.`
              : 'No hay contenido en esta sección.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {tab === 'listings'
            ? listingsFiltrados.map((l) => {
                const hidden = l.status === HIDDEN_LISTING
                return (
                  <ContentRow
                    key={l.id}
                    title={l.title}
                    subtitle={`${formatPriceShort(l.price_cents, l.currency)} · ${formatRelativeTime(l.created_at)}${
                      owner ? '' : ` · ${userName.get(l.user_id) ?? 'Cuenta sin nombre'}`
                    }`}
                    cover={l.photos[0] ?? null}
                    link={`/producto/${l.id}`}
                    statusLabel={STATUS_LABELS[l.status]}
                    hidden={hidden}
                    restoreTo={l.previous_status ? STATUS_LABELS[l.previous_status] : null}
                    busy={setStatus.isPending || deleteListing.isPending}
                    onToggle={() =>
                      setStatus.mutate({
                        kind: 'listing',
                        id: l.id,
                        action: hidden ? 'restore' : 'takeDown',
                      })
                    }
                    // El borrado definitivo solo se ofrece si ya esta retirado.
                    onDelete={hidden ? () => deleteListing.mutate(l.id) : undefined}
                    selection={{
                      checked: selected.has(l.id),
                      onChange: (on) => toggle(l.id, on),
                    }}
                  />
                )
              })
            : requestsFiltradas.map((r) => {
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
                    restoreTo={r.previous_status ? REQUEST_STATUS_LABELS[r.previous_status] : null}
                    busy={setStatus.isPending || deleteRequest.isPending}
                    onToggle={() =>
                      setStatus.mutate({
                        kind: 'request',
                        id: r.id,
                        action: hidden ? 'restore' : 'takeDown',
                      })
                    }
                    // El borrado definitivo solo se ofrece si ya está retirada.
                    onDelete={hidden ? () => deleteRequest.mutate(r.id) : undefined}
                  />
                )
              })}
        </div>
      )}

      {tab === 'listings' && <ListingBulkBar ids={selectedIds} onClear={clearSelection} />}

      {setStatus.isError && (
        <p className="mt-4 text-sm text-destructive">No se pudo cambiar el estado.</p>
      )}
    </section>
  )
}
