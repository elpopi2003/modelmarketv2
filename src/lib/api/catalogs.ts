import type { Database } from '@/integrations/supabase/types'
import { api } from './http'

export type Brand = Database['public']['Tables']['brands']['Row']
export type Category = Database['public']['Tables']['categories']['Row']

export const fetchBrands = () => api<Brand[]>('/catalog/brands')

export const fetchCategories = () => api<Category[]>('/catalog/categories')

/** Crea (o reutiliza) una marca por nombre y devuelve su id. El servidor deduplica por slug. */
export async function getOrCreateBrand(name: string): Promise<string> {
  const { id } = await api<{ id: string }>('/catalog/brands', { body: { name } })
  return id
}
