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
