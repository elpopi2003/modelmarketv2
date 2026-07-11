import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRequests } from '@/hooks/useRequests'
import { useBrands, useCategories } from '@/hooks/useCatalogs'
import { RequestCard } from '@/components/marketplace/RequestCard'
import type { RequestFilters, RequestSort } from '@/lib/api/requests'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export default function Peticiones() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [sort, setSort] = useState<RequestSort>('recent')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const filters: RequestFilters = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      sort,
    }),
    [debouncedSearch, categoryId, brandId, sort],
  )

  const { data: requests, isLoading } = useRequests(filters)
  const { data: brands } = useBrands()
  const { data: categories } = useCategories()

  const brandNames = useMemo(() => new Map((brands ?? []).map((b) => [b.id, b.name])), [brands])
  const categoryNames = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c.name])),
    [categories],
  )

  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <div className="mm-section-header">
        <span className="mm-section-header__label">Buscados</span>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Peticiones</h1>
        <Button asChild variant="accent">
          <Link to="/crear-peticion">Crear petición</Link>
        </Button>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Buscar peticiones…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={selectClass}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Categoría"
        >
          <option value="">Todas las categorías</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          aria-label="Marca"
        >
          <option value="">Todas las marcas</option>
          {brands?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={sort}
          onChange={(e) => setSort(e.target.value as RequestSort)}
          aria-label="Ordenar"
        >
          <option value="recent">Más recientes</option>
          <option value="budget_desc">Presupuesto: mayor</option>
          <option value="budget_asc">Presupuesto: menor</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : !requests || requests.length === 0 ? (
        <div className="mm-border-technical rounded-md p-12 text-center">
          <p className="text-muted-foreground">Todavía no hay peticiones. ¿Buscas algo? Publica la primera.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              brandName={request.brand_id ? brandNames.get(request.brand_id) : undefined}
              categoryName={request.category_id ? categoryNames.get(request.category_id) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  )
}
