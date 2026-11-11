import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CircleCheck, FileSpreadsheet, Upload } from 'lucide-react'
import { useAdminUsers } from '@/hooks/useAdmin'
import { useCategories } from '@/hooks/useCatalogs'
import {
  commitImport,
  previewImport,
  type ImportOptions,
  type ImportPreview,
  type ImportResult,
} from '@/lib/api/import'
import { getErrorMessage } from '@/lib/errors'
import { CONDITION_LABELS, DECALS_LABELS, formatPriceShort } from '@/lib/format'
import { queryKeys } from '@/lib/queryKeys'
import { AdminNav } from '@/components/admin/AdminNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, matchesSearch } from '@/lib/utils'

/** Valor del selector de categoría para "sin categoría" (null en la API). */
const NO_CATEGORY = 'none'

const panel = 'rounded-lg border-2 border-border bg-card p-5 shadow-sm'
const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'

/**
 * Importador masivo de maquetas desde un Excel de colección (+ ZIP de imágenes nombradas
 * por referencia). Tres pasos: datos del lote → vista previa (y categorías pendientes) →
 * importar. El servidor vuelve a validarlo todo al importar.
 */
export default function AdminImportar() {
  const queryClient = useQueryClient()
  const { data: users = [] } = useAdminUsers()
  const { data: categories = [] } = useCategories()

  const [userSearch, setUserSearch] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [excel, setExcel] = useState<File | null>(null)
  const [zip, setZip] = useState<File | null>(null)
  const [options, setOptions] = useState<ImportOptions>({
    shippingAvailable: false,
    handDelivery: true,
    acceptsOffers: true,
    decals: 'perfect',
    markAsSold: false,
  })

  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [chosen, setChosen] = useState<Record<number, string>>({})
  const [bulkCategory, setBulkCategory] = useState('')
  const [onlySkipped, setOnlySkipped] = useState(false)
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const filteredUsers = useMemo(
    () => users.filter((u) => matchesSearch(userSearch, [u.display_name, u.username, u.email])),
    [users, userSearch],
  )
  const owner = users.find((u) => u.id === ownerId)

  // Cualquier cambio en lo que se analiza invalida la vista previa.
  function invalidate() {
    setPreview(null)
    setChosen({})
    setResult(null)
    setError(null)
  }

  async function analyze() {
    if (!excel || !ownerId) return
    setBusy('preview')
    setError(null)
    setResult(null)
    try {
      setPreview(await previewImport({ excel, zip }, ownerId))
      setChosen({})
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const pending = preview?.rows.filter((r) => r.status === 'ok' && r.needsCategory) ?? []
  const missingCategories = pending.filter((r) => !chosen[r.row]).length

  function applyBulk() {
    if (!bulkCategory) return
    setChosen((prev) => {
      const next = { ...prev }
      for (const r of pending) if (!next[r.row]) next[r.row] = bulkCategory
      return next
    })
  }

  async function runImport() {
    if (!excel || !ownerId || !preview) return
    setBusy('import')
    setError(null)
    try {
      const categoriesPayload: Record<string, string | null> = {}
      for (const r of pending) {
        categoriesPayload[String(r.row)] = chosen[r.row] === NO_CATEGORY ? null : chosen[r.row]
      }
      const res = await commitImport(
        { excel, zip },
        { ownerId, options, categories: categoriesPayload },
      )
      setResult(res)
      setPreview(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.listings.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.brands })
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name
  const rows = preview?.rows.filter((r) => !onlySkipped || r.status === 'skip') ?? []

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <AdminNav />
      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
        <FileSpreadsheet className="size-7" /> Importar maquetas
      </h1>
      <p className="mt-1 max-w-prose text-muted-foreground">
        Crea anuncios en bloque a partir del Excel de una colección. Las imágenes van en un ZIP,
        cada una con el nombre de su referencia (<code>24229.jpg</code> o{' '}
        <code>Tamiya-24229.jpg</code>); se publican marcadas como «Foto de catálogo».
      </p>

      {/* 1 · Datos del lote */}
      <div className={cn(panel, 'mt-6 space-y-5')}>
        <h2 className="font-display text-lg font-extrabold">1 · Datos del lote</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="owner-search">Cuenta destinataria</Label>
            <Input
              id="owner-search"
              placeholder="Buscar por nombre o email…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <select
              aria-label="Cuenta destinataria"
              className={selectClass}
              value={ownerId}
              onChange={(e) => {
                setOwnerId(e.target.value)
                invalidate()
              }}
            >
              <option value="">Elige una cuenta…</option>
              {filteredUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name || u.username || u.email} — {u.email}
                </option>
              ))}
            </select>
            {owner?.suspended_at && (
              <p className="text-xs text-destructive">
                Esta cuenta está suspendida: sus anuncios no serán visibles.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="excel">Excel de la colección (.xlsx)</Label>
              <Input
                id="excel"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  setExcel(e.target.files?.[0] ?? null)
                  invalidate()
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">Imágenes (.zip)</Label>
              <Input
                id="zip"
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => {
                  setZip(e.target.files?.[0] ?? null)
                  invalidate()
                }}
              />
              <p className="text-xs text-muted-foreground">Las filas sin imagen no se importan.</p>
            </div>
          </div>
        </div>

        <fieldset className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Para todo el lote</legend>
          {(
            [
              ['shippingAvailable', 'Envíos disponibles'],
              ['handDelivery', 'Entrega en mano'],
              ['acceptsOffers', 'Acepta ofertas por debajo del precio'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={options[key]}
                onChange={(e) => setOptions((o) => ({ ...o, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm">
            Calcas
            <select
              className={cn(selectClass, 'w-auto')}
              value={options.decals}
              onChange={(e) =>
                setOptions((o) => ({ ...o, decals: e.target.value as ImportOptions['decals'] }))
              }
            >
              {Object.entries(DECALS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={options.markAsSold}
              onChange={(e) => setOptions((o) => ({ ...o, markAsSold: e.target.checked }))}
            />
            <span>
              <span className="font-medium">Marcar como vendidas</span>
              <span className="block text-xs text-muted-foreground">
                Salen en el catálogo con la banda «¡VENDIDA!», sin admitir ofertas ni ocupar hueco
                del plan. No se duplican al reimportar.
              </span>
            </span>
          </label>
        </fieldset>

        <Button onClick={analyze} disabled={!excel || !ownerId || busy !== null}>
          {busy === 'preview' ? 'Analizando…' : 'Analizar'}
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {/* 2 · Vista previa */}
      {preview && (
        <div className={cn(panel, 'mt-6 space-y-4')}>
          <h2 className="font-display text-lg font-extrabold">2 · Revisa antes de importar</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {(
              [
                ['Se importan', preview.summary.toImport],
                ['Se saltan', preview.summary.skipped],
                ['Imágenes en el ZIP', preview.summary.images],
                ['Categorías por elegir', pending.length],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-md border border-border p-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="mm-mono text-2xl font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          {preview.summary.newBrands.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Se crearán estas marcas: {preview.summary.newBrands.join(', ')}.
            </p>
          )}

          {pending.length > 0 && (
            <div className="flex flex-wrap items-end gap-2 rounded-md border border-accent/40 bg-accent/10 p-3">
              <div className="min-w-48 flex-1 space-y-1">
                <Label htmlFor="bulk-cat">Categoría para las {missingCategories} pendientes</Label>
                <select
                  id="bulk-cat"
                  className={selectClass}
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                >
                  <option value="">Elige…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value={NO_CATEGORY}>Sin categoría</option>
                </select>
              </div>
              <Button variant="outline" onClick={applyBulk} disabled={!bulkCategory}>
                Aplicar a las pendientes
              </Button>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={onlySkipped}
              onChange={(e) => setOnlySkipped(e.target.checked)}
            />
            Ver solo las que se saltan
          </label>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Fila</th>
                  <th className="px-3 py-2">Maqueta</th>
                  <th className="px-3 py-2">Escala</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-right">Precio</th>
                  <th className="px-3 py-2">Categoría</th>
                  <th className="px-3 py-2">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr
                    key={r.row}
                    className={cn(r.status === 'skip' && 'bg-muted/30 text-muted-foreground')}
                  >
                    <td className="mm-mono px-3 py-2">{r.row}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{r.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.brand}
                        {r.brandIsNew && ' (nueva)'}
                        {r.reference && ` · ${r.reference}`}
                        {r.quantity > 1 && ` · ${r.quantity} uds.`}
                      </div>
                      {r.warnings.map((w) => (
                        <div
                          key={w}
                          className="mt-1 flex items-start gap-1 text-xs text-foreground"
                        >
                          <AlertTriangle
                            className="mt-0.5 size-3 shrink-0 text-accent"
                            aria-hidden
                          />
                          {w}
                        </div>
                      ))}
                    </td>
                    <td className="mm-mono px-3 py-2">{r.scale ?? '—'}</td>
                    <td className="px-3 py-2">{CONDITION_LABELS[r.condition]}</td>
                    <td className="mm-mono px-3 py-2 text-right">
                      {r.priceCents !== null ? formatPriceShort(r.priceCents) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {r.status === 'ok' && r.needsCategory ? (
                        <select
                          aria-label={`Categoría de la fila ${r.row}`}
                          className={cn(selectClass, !chosen[r.row] && 'border-accent')}
                          value={chosen[r.row] ?? ''}
                          onChange={(e) => setChosen((c) => ({ ...c, [r.row]: e.target.value }))}
                        >
                          <option value="">
                            Elige… {r.categorySource ? `(${r.categorySource})` : ''}
                          </option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                          <option value={NO_CATEGORY}>Sin categoría</option>
                        </select>
                      ) : (
                        (categoryName(r.categoryId) ?? r.categorySource ?? '—')
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.status === 'ok' ? (
                        <span className="inline-flex items-center gap-1 text-sealed-ink">
                          <CircleCheck className="size-4" aria-hidden /> Se importa
                        </span>
                      ) : (
                        <span className="text-destructive">{r.skipReason}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={runImport}
              disabled={busy !== null || preview.summary.toImport === 0 || missingCategories > 0}
            >
              <Upload className="size-4" />
              {busy === 'import'
                ? 'Importando… (puede tardar un minuto)'
                : `Importar ${preview.summary.toImport} anuncios${options.markAsSold ? ' como vendidos' : ''}`}
            </Button>
            {missingCategories > 0 && (
              <p className="text-sm text-muted-foreground">
                Falta elegir la categoría de {missingCategories}{' '}
                {missingCategories === 1 ? 'fila' : 'filas'}.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 3 · Resultado */}
      {result && (
        <div className={cn(panel, 'mt-6 space-y-3')} role="status">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
            <CircleCheck className="size-5 text-sealed-ink" /> Importados {result.created} anuncios
          </h2>
          {owner && (
            <p className="text-sm text-muted-foreground">
              {options.markAsSold
                ? `Publicados como vendidos a nombre de ${owner.display_name || owner.email}: salen en el catálogo con «¡VENDIDA!».`
                : `Ya están publicados a nombre de ${owner.display_name || owner.email}.`}{' '}
              <Link to="/admin/contenido" className="underline underline-offset-4">
                Ver en Contenido
              </Link>
            </p>
          )}
          {result.newBrands.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Marcas creadas: {result.newBrands.join(', ')}.
            </p>
          )}
          {result.skipped.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">
                {result.skipped.length} filas no se importaron
              </summary>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {result.skipped.map((s) => (
                  <li key={s.row}>
                    Fila {s.row} · {s.title}: {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
