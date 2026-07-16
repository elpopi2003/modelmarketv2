import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useRequests } from '@/hooks/useRequests'
import { useBrands, useCategories } from '@/hooks/useCatalogs'
import { fetchPublicProfiles } from '@/lib/api/profiles'
import { queryKeys } from '@/lib/queryKeys'
import { RequestCard } from '@/components/marketplace/RequestCard'
import { RequestDialog } from '@/components/marketplace/RequestDialog'
import type { Request, RequestFilters, RequestSort } from '@/lib/api/requests'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export default function Peticiones() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [brandId, setBrandId] = useState('')
  const [sort, setSort] = useState<RequestSort>('recent')
  const [selected, setSelected] = useState<Request | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const filters: RequestFilters = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      brandId: brandId || undefined,
      sort,
    }),
    [debouncedSearch, brandId, sort],
  )

  const { data: requests, isLoading } = useRequests(filters)
  const { data: brands } = useBrands()
  const { data: categories } = useCategories()

  const brandNames = useMemo(() => new Map((brands ?? []).map((b) => [b.id, b.name])), [brands])
  const categoryNames = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c.name])),
    [categories],
  )

  const authorIds = useMemo(() => (requests ?? []).map((r) => r.user_id), [requests])
  const { data: authors } = useQuery({
    queryKey: [...queryKeys.profile.all, 'list', authorIds],
    queryFn: () => fetchPublicProfiles(authorIds),
    enabled: authorIds.length > 0,
  })
  const authorById = useMemo(() => new Map((authors ?? []).map((a) => [a.id, a])), [authors])

  const nameOf = (userId: string) => {
    const author = authorById.get(userId)
    return author?.display_name || author?.username || undefined
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight sm:text-4xl">Peticiones</h1>

      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row">
        <p className="max-w-2xl rounded-lg bg-muted p-5 text-sm leading-relaxed text-muted-foreground">
          Todos buscamos esa maqueta especial, descatalogada, complicada de encontrar. En esta
          sección puedes colgar esa maqueta soñada, y quien sabe, alguien puede tener lo que buscas
          en su stash…
        </p>
        <Button asChild variant="accent" className="shrink-0">
          <Link to="/crear-peticion">
            <Plus /> Nueva petición
          </Link>
        </Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto]">
        <Input
          placeholder="Buscar peticiones…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : !requests || requests.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">
            Todavía no hay peticiones. ¿Buscas algo? Publica la primera.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {requests.length} {requests.length === 1 ? 'petición encontrada' : 'peticiones encontradas'}
          </p>
          <div className="space-y-4">
            {requests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                brandName={request.brand_id ? brandNames.get(request.brand_id) : undefined}
                authorName={nameOf(request.user_id)}
                authorLocation={authorById.get(request.user_id)?.location}
                onOpen={() => setSelected(request)}
              />
            ))}
          </div>
        </>
      )}

      <RequestDialog
        request={selected}
        brandName={selected?.brand_id ? brandNames.get(selected.brand_id) : undefined}
        categoryName={selected?.category_id ? categoryNames.get(selected.category_id) : undefined}
        authorName={selected ? nameOf(selected.user_id) : undefined}
        authorLocation={selected ? authorById.get(selected.user_id)?.location : undefined}
        onClose={() => setSelected(null)}
      />
    </section>
  )
}
