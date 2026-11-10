import type { Database, ReportReason, ReportStatus } from '@/integrations/supabase/types'
import { takeDownContent } from './admin'
import { api, qs } from './http'

export type Report = Database['public']['Tables']['reports']['Row']

export interface CreateReportInput {
  /** Indica exactamente uno de los tres. */
  listingId?: string
  requestId?: string
  reportedUserId?: string
  reason: ReportReason
  details?: string
}

/**
 * Crea una denuncia en nombre del usuario con sesión. El servidor impide denunciar lo
 * propio o repetir una denuncia pendiente. El primer parámetro se mantiene por compatibilidad.
 */
export function createReport(_reporterId: string, input: CreateReportInput): Promise<Report> {
  return api<Report>('/reports', {
    body: {
      listingId: input.listingId ?? null,
      requestId: input.requestId ?? null,
      reportedUserId: input.reportedUserId ?? null,
      reason: input.reason,
      details: input.details?.trim() || null,
    },
  })
}

/** Un reporte con el contexto necesario para moderarlo. */
export interface ReportListItem {
  report: Report
  targetKind: 'listing' | 'request' | 'user'
  targetTitle: string
  /** Ruta al contenido denunciado (null para usuarios: no hay perfil público todavía). */
  targetLink: string | null
  reporterName: string
}

/** Cola de moderación (solo admins). */
export function fetchReports(status?: ReportStatus): Promise<ReportListItem[]> {
  return api<ReportListItem[]>(`/admin/reports${qs({ status })}`)
}

/** Resuelve o descarta una denuncia. El admin sale de la sesión. */
export async function resolveReport(
  reportId: string,
  _adminId: string,
  status: Extract<ReportStatus, 'resolved' | 'dismissed'>,
  note?: string,
): Promise<void> {
  await api(`/admin/reports/${reportId}`, {
    method: 'PATCH',
    body: { status, note: note?.trim() || null },
  })
}

/** Retira contenido denunciado (guarda el estado previo: se puede restaurar). */
export const takeDownListing = (listingId: string) => takeDownContent('listing', listingId)
export const takeDownRequest = (requestId: string) => takeDownContent('request', requestId)

export interface AdminStats {
  users: number
  listings: number
  requests: number
  offers: number
  reports_pending: number
}

export const fetchAdminStats = () => api<AdminStats>('/admin/stats')
