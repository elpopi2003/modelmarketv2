import type { Database } from '@/integrations/supabase/types'
import { api, qs } from './http'

export type Request = Database['public']['Tables']['requests']['Row']
export type RequestInsert = Database['public']['Tables']['requests']['Insert']
export type RequestUpdate = Database['public']['Tables']['requests']['Update']

export type RequestSort = 'recent' | 'budget_desc' | 'budget_asc'

export interface RequestFilters {
  categoryId?: string
  brandId?: string
  search?: string
  sort?: RequestSort
}

function writable<T extends Partial<RequestInsert>>(input: T) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, user_id, created_at, updated_at, ...rest } = input
  return rest
}

/** Peticiones públicas (abiertas, de autores no suspendidos). */
export function fetchRequests(filters: RequestFilters = {}): Promise<Request[]> {
  return api<Request[]>(
    `/requests${qs({
      category: filters.categoryId,
      brand: filters.brandId,
      q: filters.search?.trim(),
      sort: filters.sort,
    })}`,
  )
}

/** Una petición, si quien la pide puede verla; null si no existe o no está disponible. */
export async function fetchRequestById(id: string): Promise<Request | null> {
  try {
    return await api<Request>(`/requests/${id}`)
  } catch (error) {
    if ((error as { code?: string }).code === 'not_found') return null
    throw error
  }
}

/** Peticiones del usuario con sesión, en cualquier estado. */
export function fetchMyRequests(): Promise<Request[]> {
  return api<Request[]>('/requests/mine')
}

export function createRequest(input: RequestInsert): Promise<Request> {
  return api<Request>('/requests', { body: writable(input) })
}

export function updateRequest(id: string, updates: RequestUpdate): Promise<Request> {
  return api<Request>(`/requests/${id}`, { method: 'PATCH', body: writable(updates) })
}

export async function deleteRequest(id: string): Promise<void> {
  await api(`/requests/${id}`, { method: 'DELETE' })
}
