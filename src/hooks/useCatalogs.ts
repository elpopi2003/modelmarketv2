import { useQuery } from '@tanstack/react-query'
import { fetchBrands, fetchCategories } from '@/lib/api/catalogs'
import { queryKeys } from '@/lib/queryKeys'

const CATALOG_STALE_TIME = 1000 * 60 * 60 // 1h: los catálogos cambian rara vez.

export function useBrands() {
  return useQuery({
    queryKey: queryKeys.catalog.brands,
    queryFn: fetchBrands,
    staleTime: CATALOG_STALE_TIME,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.catalog.categories,
    queryFn: fetchCategories,
    staleTime: CATALOG_STALE_TIME,
  })
}
