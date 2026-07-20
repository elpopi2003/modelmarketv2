import { describe, expect, it } from 'vitest'
import { pageWindow } from './usePagination'

describe('pageWindow', () => {
  it('muestra todas las páginas sin huecos cuando son pocas', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('colapsa el centro cuando estás al principio', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, null, 20])
  })

  it('deja ver las vecinas cuando estás por el medio', () => {
    expect(pageWindow(10, 20)).toEqual([1, null, 9, 10, 11, null, 20])
  })

  it('colapsa el centro cuando estás al final', () => {
    expect(pageWindow(20, 20)).toEqual([1, null, 19, 20])
  })

  it('no inventa páginas fuera de rango en los extremos', () => {
    // page-1 = 0 y page+1 = 21 quedan descartadas, no aparecen como botones.
    const primera = pageWindow(1, 20)
    const ultima = pageWindow(20, 20)
    expect(primera.every((p) => p === null || (p >= 1 && p <= 20))).toBe(true)
    expect(ultima.every((p) => p === null || (p >= 1 && p <= 20))).toBe(true)
  })

  it('no deja huecos de una sola página (sería más largo que el número)', () => {
    // Con 8 páginas y estando en la 3, el salto 1→2 no debe convertirse en «…».
    expect(pageWindow(3, 8)).toEqual([1, 2, 3, 4, null, 8])
  })
})
