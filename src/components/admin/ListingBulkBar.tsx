import { useId, useState, type ReactNode } from 'react'
import { CheckSquare, Pencil, Trash2, X } from 'lucide-react'
import { useCategories } from '@/hooks/useCatalogs'
import { useBulkDeleteListings, useBulkUpdateListings } from '@/hooks/useAdmin'
import type { BulkListingChanges, BulkListingStatus } from '@/lib/api/admin'
import { CONDITION_LABELS, DECALS_LABELS } from '@/lib/format'
import type { DecalsStatus, ListingCondition } from '@/integrations/supabase/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'

const STATUS_OPTIONS: Record<BulkListingStatus, string> = {
  active: 'Activo',
  reserved: 'Reservado',
  sold_showcase: 'Vendido · en el catálogo con «¡VENDIDA!»',
  sold: 'Vendido · fuera del catálogo',
  archived: 'Suspendido',
}

/** '' = sin cambios. Los booleanos van como 'yes' / 'no'. */
interface Draft {
  status: '' | BulkListingStatus
  category: string
  condition: '' | ListingCondition
  decals: '' | DecalsStatus
  shipping: '' | 'yes' | 'no'
  hand: '' | 'yes' | 'no'
  offers: '' | 'yes' | 'no'
  pricePercent: string
}

const EMPTY: Draft = {
  status: '',
  category: '',
  condition: '',
  decals: '',
  shipping: '',
  hand: '',
  offers: '',
  pricePercent: '',
}

const yesNo = (v: Draft['shipping']) => (v === '' ? undefined : v === 'yes')

/** Solo lo que se ha tocado; el resto de cada anuncio se queda como está. */
function toChanges(d: Draft): BulkListingChanges {
  const pct = d.pricePercent.trim() === '' ? undefined : Number(d.pricePercent)
  return {
    ...(d.status ? { status: d.status } : {}),
    // 'none' = quitar la categoría (queda «sin categoría»).
    ...(d.category ? { category_id: d.category === 'none' ? null : d.category } : {}),
    ...(d.condition ? { condition: d.condition } : {}),
    ...(d.decals ? { decals: d.decals } : {}),
    ...(yesNo(d.shipping) !== undefined ? { shipping_inpost: yesNo(d.shipping) } : {}),
    ...(yesNo(d.hand) !== undefined ? { hand_delivery: yesNo(d.hand) } : {}),
    ...(yesNo(d.offers) !== undefined ? { accepts_offers: yesNo(d.offers) } : {}),
    ...(pct !== undefined ? { price_percent: pct } : {}),
  }
}

/** Etiqueta asociada a su control por id (los lectores de pantalla anuncian «Estado», no «Sin cambios»). */
function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="grid gap-1 text-sm">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {children(id)}
    </div>
  )
}

function YesNoSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: Draft['shipping']
  onChange: (v: Draft['shipping']) => void
}) {
  return (
    <select
      id={id}
      className={selectClass}
      value={value}
      onChange={(e) => onChange(e.target.value as Draft['shipping'])}
    >
      <option value="">Sin cambios</option>
      <option value="yes">Sí</option>
      <option value="no">No</option>
    </select>
  )
}

/**
 * Barra de acciones sobre los anuncios seleccionados en Contenido: edición en bloque (solo
 * los campos que se cambien) y borrado definitivo con confirmación. Se queda fija abajo
 * mientras se recorre la lista.
 */
export function ListingBulkBar({
  ids,
  onClear,
}: {
  /** Anuncios seleccionados (y visibles con los filtros actuales). */
  ids: string[]
  onClear: () => void
}) {
  const [mode, setMode] = useState<'idle' | 'edit' | 'delete'>('idle')
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [notice, setNotice] = useState<string | null>(null)
  const { data: categories } = useCategories()
  const update = useBulkUpdateListings()
  const remove = useBulkDeleteListings()
  const busy = update.isPending || remove.isPending

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const changes = toChanges(draft)
  const hasChanges = Object.keys(changes).length > 0
  const pct = Number(draft.pricePercent)
  const pctInvalid =
    draft.pricePercent.trim() !== '' &&
    (!Number.isInteger(pct) || pct < -90 || pct > 500 || pct === 0)
  const n = ids.length
  const plural = n === 1 ? 'anuncio' : 'anuncios'
  const error = (update.error ?? remove.error) as Error | null

  function close() {
    setMode('idle')
    update.reset()
    remove.reset()
  }

  function apply() {
    update.mutate(
      { ids, changes },
      {
        onSuccess: ({ updated, skippedModerated }) => {
          setNotice(
            `Actualizados ${updated} ${updated === 1 ? 'anuncio' : 'anuncios'}.` +
              (skippedModerated > 0
                ? ` ${skippedModerated} retirado${skippedModerated === 1 ? '' : 's'} por moderación no cambia${skippedModerated === 1 ? '' : 'n'} de estado: se restauran con su botón.`
                : ''),
          )
          setDraft(EMPTY)
          setMode('idle')
        },
      },
    )
  }

  function confirmDelete() {
    remove.mutate(ids, {
      onSuccess: ({ deleted }) => {
        setNotice(`Eliminados ${deleted} ${deleted === 1 ? 'anuncio' : 'anuncios'}.`)
        setMode('idle')
        onClear()
      },
    })
  }

  if (n === 0) {
    return notice ? (
      <p role="status" className="mt-4 text-sm text-muted-foreground">
        {notice}
      </p>
    ) : null
  }

  const sortedCategories = [...(categories ?? [])].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div
      role="region"
      aria-label="Acciones sobre la selección"
      className="sticky bottom-4 z-30 mt-6 rounded-lg border-2 border-primary bg-card p-4 text-card-foreground shadow-blueprint"
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="mm-mono mr-auto inline-flex items-center gap-2 text-sm font-semibold">
          <CheckSquare className="size-4 text-primary" aria-hidden />
          {n} {plural} seleccionado{n === 1 ? '' : 's'}
        </p>
        <Button
          size="sm"
          variant={mode === 'edit' ? 'default' : 'outline'}
          disabled={busy}
          onClick={() => (mode === 'edit' ? close() : (setMode('edit'), setNotice(null)))}
        >
          <Pencil /> Editar
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => (setMode('delete'), setNotice(null))}
          className="border-destructive/40 text-destructive hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 /> Eliminar
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onClear}>
          <X /> Quitar selección
        </Button>
      </div>

      {mode === 'edit' && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Solo se cambia lo que elijas; lo que quede en «Sin cambios» se respeta en cada anuncio.
          </p>
          <div className="grid max-h-[50vh] gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Estado">
              {(id) => (
                <select
                  id={id}
                  className={selectClass}
                  value={draft.status}
                  onChange={(e) => set('status', e.target.value as Draft['status'])}
                >
                  <option value="">Sin cambios</option>
                  {Object.entries(STATUS_OPTIONS).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Categoría">
              {(id) => (
                <select
                  id={id}
                  className={selectClass}
                  value={draft.category}
                  onChange={(e) => set('category', e.target.value)}
                >
                  <option value="">Sin cambios</option>
                  <option value="none">Sin categoría</option>
                  {sortedCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Estado del kit">
              {(id) => (
                <select
                  id={id}
                  className={selectClass}
                  value={draft.condition}
                  onChange={(e) => set('condition', e.target.value as Draft['condition'])}
                >
                  <option value="">Sin cambios</option>
                  {Object.entries(CONDITION_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Calcas">
              {(id) => (
                <select
                  id={id}
                  className={selectClass}
                  value={draft.decals}
                  onChange={(e) => set('decals', e.target.value as Draft['decals'])}
                >
                  <option value="">Sin cambios</option>
                  {Object.entries(DECALS_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Envíos disponibles">
              {(id) => (
                <YesNoSelect id={id} value={draft.shipping} onChange={(v) => set('shipping', v)} />
              )}
            </Field>
            <Field label="Entrega en mano">
              {(id) => <YesNoSelect id={id} value={draft.hand} onChange={(v) => set('hand', v)} />}
            </Field>
            <Field label="Acepta ofertas por debajo">
              {(id) => (
                <YesNoSelect id={id} value={draft.offers} onChange={(v) => set('offers', v)} />
              )}
            </Field>
            <Field label="Ajustar precio (%)">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={-90}
                  max={500}
                  placeholder="p. ej. -10"
                  className="h-9"
                  value={draft.pricePercent}
                  onChange={(e) => set('pricePercent', e.target.value)}
                  aria-invalid={pctInvalid || undefined}
                />
              )}
            </Field>
          </div>
          {pctInvalid && (
            <p className="mt-2 text-xs text-destructive">
              El ajuste es un número entero entre -90 y 500, distinto de 0.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy || !hasChanges || pctInvalid} onClick={apply}>
              {update.isPending ? 'Aplicando…' : `Aplicar a ${n} ${plural}`}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={close}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {mode === 'delete' && (
        <div className="mt-4 rounded-md border-2 border-destructive/60 bg-destructive/10 p-3">
          <p className="text-sm font-semibold text-destructive">
            ¿Eliminar definitivamente {n} {plural}?
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Se borran también sus fotos, ofertas y conversaciones. No se puede deshacer.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="destructive" disabled={busy} onClick={confirmDelete}>
              {remove.isPending ? 'Eliminando…' : `Sí, eliminar ${n}`}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={close}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error.message}</p>}
      {notice && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {notice}
        </p>
      )}
    </div>
  )
}
