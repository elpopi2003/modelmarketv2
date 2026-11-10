import { useQuery } from '@tanstack/react-query'
import { fetchPlatform } from '@/lib/api/platform'
import { queryKeys } from '@/lib/queryKeys'

/** Modo de la plataforma (p. ej. beta con PRO gratis). Cambia muy poco: se cachea 10 min. */
export function usePlatform() {
  const { data } = useQuery({
    queryKey: queryKeys.platform,
    queryFn: fetchPlatform,
    staleTime: 10 * 60_000,
  })
  return { betaAllPro: data?.betaAllPro ?? false }
}
