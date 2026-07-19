import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Une clases de Tailwind resolviendo conflictos (patrón shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normaliza texto para buscar: minúsculas y sin acentos.
 * En castellano es imprescindible — sin esto, «aviacion» no encontraría «Aviación»
 * y quien busca no suele escribir las tildes.
 */
/**
 * Marcas diacríticas combinantes que NFD separa de su letra base.
 * Se construye desde una cadena ASCII a propósito: escrito como literal regex, el
 * fichero contendría caracteres invisibles que cualquier edición podría romper.
 */
const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

export function normalizeForSearch(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(DIACRITICS, '')
}

/** ¿Alguno de los campos contiene el término? Ignora acentos, mayúsculas y nulos. */
export function matchesSearch(term: string, fields: (string | null | undefined)[]): boolean {
  const needle = normalizeForSearch(term.trim())
  if (!needle) return true
  return fields.some((field) => field && normalizeForSearch(field).includes(needle))
}
