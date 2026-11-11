import type { DecalsStatus, ListingCondition } from '@/integrations/supabase/types'
import { postForm } from './http'

/** Opciones que se aplican a todo el lote importado. */
export interface ImportOptions {
  shippingAvailable: boolean
  handDelivery: boolean
  acceptsOffers: boolean
  decals: DecalsStatus
  /** Importar todo el lote como vendido: en el catálogo con «¡VENDIDA!», sin ofertas. */
  markAsSold: boolean
}

export interface ImportPreviewRow {
  row: number
  brand: string
  brandIsNew: boolean
  reference: string | null
  title: string
  scale: string | null
  categorySource: string | null
  categoryId: string | null
  needsCategory: boolean
  condition: ListingCondition
  priceCents: number | null
  quantity: number
  hasImage: boolean
  status: 'ok' | 'skip'
  skipReason: string | null
  warnings: string[]
}

export interface ImportPreview {
  rows: ImportPreviewRow[]
  summary: {
    total: number
    toImport: number
    skipped: number
    needCategory: number
    newBrands: string[]
    unknownCategories: string[]
    images: number
  }
}

export interface ImportResult {
  created: number
  skipped: { row: number; title: string; reason: string | null }[]
  newBrands: string[]
}

function form(files: { excel: File; zip: File | null }, fields: Record<string, string>) {
  const f = new FormData()
  // Los campos van antes que los ficheros: el servidor los lee en orden.
  for (const [k, v] of Object.entries(fields)) f.append(k, v)
  f.append('excel', files.excel)
  if (files.zip) f.append('zip', files.zip)
  return f
}

/** Paso 1: analiza el Excel (y el ZIP) sin escribir nada. */
export function previewImport(files: { excel: File; zip: File | null }, ownerId: string) {
  return postForm<ImportPreview>('/admin/import/preview', form(files, { ownerId }))
}

/**
 * Paso 2: importa. Se reenvían los mismos ficheros con lo elegido en la vista previa
 * (categorías por número de fila; null = sin categoría).
 */
export function commitImport(
  files: { excel: File; zip: File | null },
  payload: { ownerId: string; options: ImportOptions; categories: Record<string, string | null> },
) {
  return postForm<ImportResult>(
    '/admin/import/commit',
    form(files, { payload: JSON.stringify(payload) }),
  )
}
