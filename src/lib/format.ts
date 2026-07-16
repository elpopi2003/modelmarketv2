import type {
  DecalsStatus,
  ListingCondition,
  ListingStatus,
  OfferStatus,
  RequestStatus,
} from '@/integrations/supabase/types'

/** Formatea un importe en céntimos como moneda (por defecto EUR, locale es-ES). */
export function formatPrice(cents: number, currency = 'EUR', locale = 'es-ES'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}

/**
 * Precio compacto tipo marketplace: "40€" cuando es un importe entero, "12,50€" si no.
 * Para EUR pega el símbolo sin espacio (como en las tarjetas). Otras monedas → formatPrice.
 */
export function formatPriceShort(cents: number, currency = 'EUR', locale = 'es-ES'): string {
  if (currency !== 'EUR') return formatPrice(cents, currency, locale)
  const euros = cents / 100
  const value = Number.isInteger(euros)
    ? String(euros)
    : euros.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${value}€`
}

export const CONDITION_LABELS: Record<ListingCondition, string> = {
  sealed: 'Precintado',
  opened: 'Abierto',
  started: 'Empezado',
}

/** Descripción larga del estado, para la fila de confianza del anuncio. */
export const CONDITION_DESCRIPTIONS: Record<ListingCondition, string> = {
  sealed: 'Caja sin abrir, sellado de fábrica intacto',
  opened: 'Caja abierta, piezas sin usar',
  started: 'Montaje iniciado, puede faltar alguna pieza',
}

export const DECALS_LABELS: Record<DecalsStatus, string> = {
  perfect: 'Perfectas',
  yellowed: 'Amarilleadas',
  unavailable: 'No disponibles',
}

export const STATUS_LABELS: Record<ListingStatus, string> = {
  draft: 'Borrador',
  active: 'Activo',
  reserved: 'Reservado',
  sold: 'Vendido',
  archived: 'Archivado',
}

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  withdrawn: 'Retirada',
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
