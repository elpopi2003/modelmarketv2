import type { Database, ListingCondition } from '@/integrations/supabase/types'
import { api, qs } from './http'

// Los tipos siguen la forma de las filas de v2 (snake_case): el servidor devuelve los
// mismos campos para que los componentes no cambien.
export type Listing = Database['public']['Tables']['listings']['Row']
export type ListingInsert = Database['public']['Tables']['listings']['Insert']
export type ListingUpdate = Database['public']['Tables']['listings']['Update']

export type ListingSort = 'recent' | 'price_asc' | 'price_desc'

export interface ListingFilters {
  categoryId?: string
  brandId?: string
  condition?: ListingCondition
  /** Búsqueda por título (sin tildes ni mayúsculas). */
  search?: string
  minPriceCents?: number
  maxPriceCents?: number
  sort?: ListingSort
}

/** Campos que el servidor acepta al crear/editar (el autor sale de la sesión). */
type Writable = Omit<
  ListingInsert,
  | 'id'
  | 'user_id'
  | 'ref_number'
  | 'views'
  | 'visible_at'
  | 'created_at'
  | 'updated_at'
  | 'currency'
>

function writable<T extends Partial<ListingInsert>>(input: T) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, user_id, ref_number, views, visible_at, created_at, updated_at, currency, ...rest } =
    input
  return rest as Partial<Writable>
}

/** Catálogo público: activos y reservados ya publicados (los reservados, con su lazo). */
export function fetchListings(filters: ListingFilters = {}): Promise<Listing[]> {
  return api<Listing[]>(
    `/listings${qs({
      category: filters.categoryId,
      brand: filters.brandId,
      condition: filters.condition,
      q: filters.search?.trim(),
      minPrice: filters.minPriceCents,
      maxPrice: filters.maxPriceCents,
      sort: filters.sort,
    })}`,
  )
}

/** Un anuncio, si quien lo pide puede verlo; null si no existe o no está disponible. */
export async function fetchListingById(id: string): Promise<Listing | null> {
  try {
    return await api<Listing>(`/listings/${id}`)
  } catch (error) {
    if ((error as { code?: string }).code === 'not_found') return null
    throw error
  }
}

/** Anuncios del usuario con sesión, en cualquier estado. */
export function fetchMyListings(): Promise<Listing[]> {
  return api<Listing[]>('/listings/mine')
}

export function createListing(input: ListingInsert): Promise<Listing> {
  return api<Listing>('/listings', { body: writable(input) })
}

export function updateListing(id: string, updates: ListingUpdate): Promise<Listing> {
  return api<Listing>(`/listings/${id}`, { method: 'PATCH', body: writable(updates) })
}

export async function deleteListing(id: string): Promise<void> {
  await api(`/listings/${id}`, { method: 'DELETE' })
}

/**
 * Marca o desmarca el anuncio como reservado (solo su dueño). Sirve para avisar de que hay
 * un comprador en firme antes de cerrar la venta.
 */
export async function setListingReserved(listingId: string, reserved: boolean): Promise<void> {
  await updateListing(listingId, { status: reserved ? 'reserved' : 'active' })
}

/** Suma una visita. Silencioso a propósito: un contador que falla nunca rompe la ficha. */
export async function incrementListingViews(listingId: string): Promise<void> {
  try {
    await api(`/listings/${listingId}/view`, { method: 'POST', body: {} })
  } catch (error) {
    console.warn('[views] no se pudo registrar la visita', error)
  }
}
