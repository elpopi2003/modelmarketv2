import { supabase } from '@/integrations/supabase/client'
import { handleSupabaseError } from '@/lib/errors'
import type { Database } from '@/integrations/supabase/types'

export type Brand = Database['public']['Tables']['brands']['Row']
export type Category = Database['public']['Tables']['categories']['Row']

export async function fetchBrands(): Promise<Brand[]> {
  const { data, error } = await supabase.from('brands').select('*').order('name')
  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('name')
  if (error) handleSupabaseError(error)
  return data ?? []
}

/** Crea (o reutiliza) una marca por nombre y devuelve su id. RPC con dedup por slug. */
export async function getOrCreateBrand(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_brand', { _name: name })
  if (error) handleSupabaseError(error)
  return data as string
}
