import type { Listing, ListingFilters } from '@/lib/api/listings'
import type { Request, RequestFilters } from '@/lib/api/requests'
import { matchesSearch } from '@/lib/utils'

/**
 * Filtrado y orden en cliente para los bloques "Tus anuncios" / "Tus peticiones".
 *
 * Esos bloques no pueden salir del listado público (que oculta lo suspendido), así que
 * vienen de `fetchMy*`, que trae todo sin filtrar. Aquí se replican los mismos criterios
 * que aplica el servidor, para que los filtros de la página afecten a ambos bloques igual.
 *
 * Única divergencia deliberada: el servidor busca con `ilike`, sensible a acentos; aquí se
 * usa `matchesSearch`, que los ignora. En lo propio conviene ser indulgente, y quien busca
 * entre sus tres anuncios prefiere encontrarlos a que el acento cuadre.
 */

export function filterOwnListings(listings: Listing[], filters: ListingFilters): Listing[] {
  const filtered = listings.filter((l) => {
    if (filters.categoryId && l.category_id !== filters.categoryId) return false
    if (filters.brandId && l.brand_id !== filters.brandId) return false
    if (filters.condition && l.condition !== filters.condition) return false
    if (filters.search && !matchesSearch(filters.search, [l.title])) return false
    return true
  })

  return [...filtered].sort((a, b) => {
    if (filters.sort === 'price_asc') return a.price_cents - b.price_cents
    if (filters.sort === 'price_desc') return b.price_cents - a.price_cents
    return b.created_at.localeCompare(a.created_at)
  })
}

export function filterOwnRequests(requests: Request[], filters: RequestFilters): Request[] {
  const filtered = requests.filter((r) => {
    if (filters.categoryId && r.category_id !== filters.categoryId) return false
    if (filters.brandId && r.brand_id !== filters.brandId) return false
    if (filters.search && !matchesSearch(filters.search, [r.title])) return false
    return true
  })

  return [...filtered].sort((a, b) => {
    // Sin presupuesto va al final en ambos órdenes, igual que `nullsFirst: false`.
    if (filters.sort === 'budget_desc' || filters.sort === 'budget_asc') {
      if (a.max_price_cents == null) return b.max_price_cents == null ? 0 : 1
      if (b.max_price_cents == null) return -1
      return filters.sort === 'budget_asc'
        ? a.max_price_cents - b.max_price_cents
        : b.max_price_cents - a.max_price_cents
    }
    return b.created_at.localeCompare(a.created_at)
  })
}
