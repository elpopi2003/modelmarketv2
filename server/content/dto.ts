import type { Selectable } from 'kysely'
import { jsonArray } from '../db/json'
import type { ListingCondition, ListingsTable, RequestsTable } from '../db/schema'

/**
 * Forma en que la API entrega anuncios y peticiones: los mismos campos (snake_case) que
 * devolvía Supabase, para que los componentes del frontend no cambien.
 */
export function toListingDto(row: Selectable<ListingsTable>) {
  return {
    ...row,
    ref_number: Number(row.ref_number),
    photos: jsonArray<string>(row.photos),
  }
}

export function toRequestDto(row: Selectable<RequestsTable>) {
  return {
    ...row,
    photos: jsonArray<string>(row.photos),
    accepted_conditions: jsonArray<ListingCondition>(row.accepted_conditions),
  }
}

export type ListingDto = ReturnType<typeof toListingDto>
export type RequestDto = ReturnType<typeof toRequestDto>
