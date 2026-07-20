import { describe, expect, it } from 'vitest'
import type { Request } from '@/lib/api/requests'
import { filterOwnRequests } from './localFilters'

/** Petición mínima: solo los campos que mira el filtrado. */
function req(over: Partial<Request>): Request {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    title: 'Petición',
    description: null,
    category_id: null,
    brand_id: null,
    scale: null,
    max_price_cents: null,
    photos: [],
    status: 'open',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    accepted_conditions: [],
    decals_requirement: null,
    urgency: null,
    previous_status: null,
    ...over,
  } as Request
}

describe('filterOwnRequests', () => {
  it('encuentra por título ignorando acentos y mayúsculas', () => {
    const items = [req({ title: 'Busco Tiger I precintado' }), req({ title: 'Avión de época' })]
    expect(filterOwnRequests(items, { search: 'avion' })).toHaveLength(1)
    expect(filterOwnRequests(items, { search: 'TIGER' })).toHaveLength(1)
  })

  it('mantiene las suspendidas: el dueño necesita verlas para reactivarlas', () => {
    const items = [req({ status: 'closed' }), req({ status: 'open' })]
    expect(filterOwnRequests(items, {})).toHaveLength(2)
  })

  it('ordena por presupuesto dejando al final las que no lo indican', () => {
    const items = [
      req({ title: 'sin', max_price_cents: null }),
      req({ title: 'cara', max_price_cents: 9000 }),
      req({ title: 'barata', max_price_cents: 1000 }),
    ]
    expect(filterOwnRequests(items, { sort: 'budget_desc' }).map((r) => r.title)).toEqual([
      'cara',
      'barata',
      'sin',
    ])
    // "sin presupuesto" va al final también en orden ascendente, no al principio.
    expect(filterOwnRequests(items, { sort: 'budget_asc' }).map((r) => r.title)).toEqual([
      'barata',
      'cara',
      'sin',
    ])
  })

  it('ordena por fecha descendente por defecto', () => {
    const items = [
      req({ title: 'vieja', created_at: '2026-01-01T00:00:00Z' }),
      req({ title: 'nueva', created_at: '2026-06-01T00:00:00Z' }),
    ]
    expect(filterOwnRequests(items, {}).map((r) => r.title)).toEqual(['nueva', 'vieja'])
  })

  it('no muta el array recibido', () => {
    const items = [req({ title: 'a', created_at: '2026-01-01T00:00:00Z' }), req({ title: 'b' })]
    const original = [...items]
    filterOwnRequests(items, { sort: 'budget_desc' })
    expect(items).toEqual(original)
  })

  it('combina marca y búsqueda', () => {
    const items = [
      req({ title: 'Tiger', brand_id: 'tamiya' }),
      req({ title: 'Tiger', brand_id: 'meng' }),
    ]
    expect(filterOwnRequests(items, { search: 'tiger', brandId: 'meng' })).toHaveLength(1)
  })
})
