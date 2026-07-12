import type { ListingCondition, ListingStatus, RequestStatus } from '@/integrations/supabase/types'

/** Formatea un importe en céntimos como moneda (por defecto EUR, locale es-ES). */
export function formatPrice(cents: number, currency = 'EUR', locale = 'es-ES'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}

export const CONDITION_LABELS: Record<ListingCondition, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  used: 'Usado',
  for_parts: 'Para piezas',
}

export const STATUS_LABELS: Record<ListingStatus, string> = {
  draft: 'Borrador',
  active: 'Activo',
  sold: 'Vendido',
  archived: 'Archivado',
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  open: 'Abierta',
  fulfilled: 'Encontrada',
  closed: 'Cerrada',
}

/** Tiempo relativo legible ("hace 5 minutos") para fechas ISO. */
export function formatRelativeTime(iso: string, locale = 'es-ES'): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const diffSeconds = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(diffSeconds)
  if (abs < 60) return rtf.format(Math.round(diffSeconds), 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), 'hour')
  if (abs < 2592000) return rtf.format(Math.round(diffSeconds / 86400), 'day')
  return rtf.format(Math.round(diffSeconds / 2592000), 'month')
}
