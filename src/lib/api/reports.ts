import { supabase } from '@/integrations/supabase/client'
import { handleSupabaseError } from '@/lib/errors'
import type { Database, ReportReason, ReportStatus } from '@/integrations/supabase/types'

export type Report = Database['public']['Tables']['reports']['Row']

export interface CreateReportInput {
  /** Indica exactamente uno de los tres. */
  listingId?: string
  requestId?: string
  reportedUserId?: string
  reason: ReportReason
  details?: string
}

/** Crea una denuncia en nombre del usuario actual (la RLS exige reporter_id = uid). */
export async function createReport(
  reporterId: string,
  input: CreateReportInput,
): Promise<Report> {
  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: reporterId,
      listing_id: input.listingId ?? null,
      request_id: input.requestId ?? null,
      reported_user_id: input.reportedUserId ?? null,
      reason: input.reason,
      details: input.details?.trim() || null,
    })
    .select('*')
    .single()
  if (error) handleSupabaseError(error)
  return data as Report
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

/** Cola de moderación. La RLS restringe a admins (o a las propias denuncias). */
export async function fetchReports(status?: ReportStatus): Promise<ReportListItem[]> {
  let query = supabase.from('reports').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data: reports, error } = await query
  if (error) handleSupabaseError(error)
  if (!reports || reports.length === 0) return []

  const isString = (value: string | null): value is string => Boolean(value)
  const listingIds = [...new Set(reports.map((r) => r.listing_id).filter(isString))]
  const requestIds = [...new Set(reports.map((r) => r.request_id).filter(isString))]
  const profileIds = [
    ...new Set([
      ...reports.map((r) => r.reporter_id),
      ...reports.map((r) => r.reported_user_id).filter(isString),
    ]),
  ]

  const [listingsRes, requestsRes, profilesRes] = await Promise.all([
    supabase.from('listings').select('id, title').in('id', listingIds),
    supabase.from('requests').select('id, title').in('id', requestIds),
    supabase.from('profiles').select('id, display_name, username').in('id', profileIds),
  ])
  if (listingsRes.error) handleSupabaseError(listingsRes.error)
  if (requestsRes.error) handleSupabaseError(requestsRes.error)
  if (profilesRes.error) handleSupabaseError(profilesRes.error)

  const listingMap = new Map((listingsRes.data ?? []).map((l) => [l.id, l]))
  const requestMap = new Map((requestsRes.data ?? []).map((r) => [r.id, r]))
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]))
  const nameOf = (id: string) => {
    const p = profileMap.get(id)
    return p?.display_name || p?.username || 'Usuario'
  }

  return reports.map((report) => {
    if (report.listing_id) {
      return {
        report,
        targetKind: 'listing' as const,
        targetTitle: listingMap.get(report.listing_id)?.title ?? 'Anuncio eliminado',
        targetLink: `/producto/${report.listing_id}`,
        reporterName: nameOf(report.reporter_id),
      }
    }
    if (report.request_id) {
      return {
        report,
        targetKind: 'request' as const,
        targetTitle: requestMap.get(report.request_id)?.title ?? 'Petición eliminada',
        targetLink: `/peticion/${report.request_id}`,
        reporterName: nameOf(report.reporter_id),
      }
    }
    return {
      report,
      targetKind: 'user' as const,
      targetTitle: report.reported_user_id ? nameOf(report.reported_user_id) : 'Usuario',
      targetLink: null,
      reporterName: nameOf(report.reporter_id),
    }
  })
}

/** Resuelve o descarta una denuncia (solo admins, por RLS). */
export async function resolveReport(
  reportId: string,
  adminId: string,
  status: Extract<ReportStatus, 'resolved' | 'dismissed'>,
  note?: string,
): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .update({
      status,
      resolved_by: adminId,
      resolved_at: new Date().toISOString(),
      resolution_note: note?.trim() || null,
    })
    .eq('id', reportId)
  if (error) handleSupabaseError(error)
}

/** Retira contenido denunciado (admin: policy de update con has_role). */
export async function takeDownListing(listingId: string): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .update({ status: 'archived' })
    .eq('id', listingId)
  if (error) handleSupabaseError(error)
}

export async function takeDownRequest(requestId: string): Promise<void> {
  const { error } = await supabase.from('requests').update({ status: 'closed' }).eq('id', requestId)
  if (error) handleSupabaseError(error)
}

export interface AdminStats {
  users: number
  listings: number
  requests: number
  offers: number
  reports_pending: number
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('admin_stats')
  if (error) handleSupabaseError(error)
  return data as AdminStats
}
