import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import {
  createReport,
  fetchAdminStats,
  fetchReports,
  resolveReport,
  takeDownListing,
  takeDownRequest,
  type CreateReportInput,
} from '@/lib/api/reports'
import { handleSupabaseError } from '@/lib/errors'
import { queryKeys } from '@/lib/queryKeys'
import { useAuth } from '@/hooks/useAuth'
import type { ReportStatus } from '@/integrations/supabase/types'

/**
 * ¿El usuario actual es administrador? Vía RPC has_role (SECURITY DEFINER).
 * Es solo para la UI: cada operación sensible vuelve a comprobarlo en la BD.
 */
export function useIsAdmin() {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.admin.isAdmin(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user!.id,
        _role: 'admin',
      })
      if (error) handleSupabaseError(error)
      return Boolean(data)
    },
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
  })
  return { isAdmin: query.data ?? false, isLoading: query.isLoading }
}

export function useAdminStats() {
  return useQuery({ queryKey: queryKeys.admin.stats(), queryFn: fetchAdminStats })
}

export function useReports(status?: ReportStatus) {
  return useQuery({
    queryKey: queryKeys.admin.reports(status),
    queryFn: () => fetchReports(status),
  })
}

/** Envía una denuncia. */
export function useCreateReport() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateReportInput) => createReport(user!.id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all })
    },
  })
}

/** Resolver/descartar, con retirada opcional del contenido denunciado. */
export function useResolveReport() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      reportId,
      status,
      note,
      takeDown,
    }: {
      reportId: string
      status: Extract<ReportStatus, 'resolved' | 'dismissed'>
      note?: string
      takeDown?: { kind: 'listing' | 'request'; id: string }
    }) => {
      // Primero se retira el contenido: si falla, la denuncia sigue pendiente
      // (mejor que marcarla resuelta sin haber actuado).
      if (takeDown) {
        if (takeDown.kind === 'listing') await takeDownListing(takeDown.id)
        else await takeDownRequest(takeDown.id)
      }
      await resolveReport(reportId, user!.id, status, note)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.listings.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests.all })
    },
  })
}
