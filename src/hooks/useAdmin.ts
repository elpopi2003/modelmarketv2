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
import {
  deleteUserAsAdmin,
  fetchAdminUsers,
  fetchAllListings,
  fetchAllRequests,
  restoreContent,
  setUserAdmin,
  takeDownContent,
  type ContentKind,
} from '@/lib/api/admin'
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

/* ── Fase 3: usuarios y contenido ──────────────────────────────────────── */

export function useAdminUsers() {
  return useQuery({ queryKey: queryKeys.admin.users(), queryFn: fetchAdminUsers })
}

export function useSetUserAdmin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) =>
      setUserAdmin(userId, makeAdmin),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all }),
  })
}

export function useDeleteUserAsAdmin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => deleteUserAsAdmin(userId),
    onSuccess: () => {
      // El borrado cascada sobre todo su contenido: se invalida el resto también.
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.listings.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests.all })
    },
  })
}

export function useAllListings() {
  return useQuery({ queryKey: queryKeys.admin.listings(), queryFn: fetchAllListings })
}

export function useAllRequests() {
  return useQuery({ queryKey: queryKeys.admin.requests(), queryFn: fetchAllRequests })
}

/**
 * Retira o restaura contenido desde el panel. Retirar guarda el estado previo;
 * restaurar lo devuelve tal cual estaba (no siempre a "activo").
 */
export function useSetContentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { kind: ContentKind; id: string; action: 'takeDown' | 'restore' }) => {
      if (input.action === 'takeDown') await takeDownContent(input.kind, input.id)
      else await restoreContent(input.kind, input.id)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.listings.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests.all })
    },
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
