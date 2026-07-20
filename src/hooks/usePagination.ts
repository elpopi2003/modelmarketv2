import { useEffect, useMemo, useState } from 'react'

/** A partir de cuántos resultados se pagina. */
export const PAGE_SIZE = 30

/**
 * Pagina un array en cliente y devuelve el trozo visible.
 *
 * Vuelve a la página 1 cuando cambia el número de elementos: si no, al filtrar una
 * lista larga estando en la página 4 te quedarías mirando un hueco vacío.
 */
export function usePagination<T>(items: T[], pageSize: number = PAGE_SIZE) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  useEffect(() => {
    setPage(1)
  }, [items.length])

  // El estado puede ir un render por detrás del recuento; se acota al pintar.
  const safePage = Math.min(page, totalPages)

  const visible = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  )

  return {
    visible,
    page: safePage,
    totalPages,
    /** Solo hay controles si el total supera una página. */
    needsPagination: items.length > pageSize,
    goTo: (next: number) => setPage(Math.min(Math.max(1, next), totalPages)),
  }
}

/**
 * Números de página a mostrar, con huecos (`null`) donde se colapsa el rango.
 * Siempre incluye la primera, la última y las vecinas de la actual.
 */
export function pageWindow(page: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)

  const pages = new Set([1, totalPages, page, page - 1, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)

  const withGaps: (number | null)[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) withGaps.push(null)
    withGaps.push(p)
  })
  return withGaps
}
