import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import {
  useDeleteRequest,
  useMyRequests,
  useRequests,
  useUpdateRequest,
} from '@/hooks/useRequests'
import { useAuth } from '@/hooks/useAuth'
import { usePagination } from '@/hooks/usePagination'
import { filterOwnRequests } from '@/lib/localFilters'
import { Pagination } from '@/components/ui/pagination'
import { SectionHeading } from '@/components/marketplace/SectionHeading'
import { useBrands, useCategories } from '@/hooks/useCatalogs'
import { fetchPublicProfiles } from '@/lib/api/profiles'
import { queryKeys } from '@/lib/queryKeys'
import { RequestCard } from '@/components/marketplace/RequestCard'
import { RequestDialog } from '@/components/marketplace/RequestDialog'
import type { Request, RequestFilters, RequestSort } from '@/lib/api/requests'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Seo } from '@/components/seo/Seo'

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * Dos columnas a partir de `lg`. Antes se quedan a una: la tarjeta es horizontal
 * (miniatura + texto + presupuesto) y por debajo de eso se estrangula.
 */
function RequestGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>
}

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

  const { user } = useAuth()
  const { data: requests, isLoading } = useRequests(filters)
  // Las propias vienen de su propia consulta: el listado público solo trae las abiertas,
  // así que desde ahí no se podría ver ni reactivar una que hayas suspendido.
  const { data: myRequests } = useMyRequests()
  const { data: brands } = useBrands()
  const { data: categories } = useCategories()
  const deleteRequest = useDeleteRequest()
  const updateRequest = useUpdateRequest()

  const ownRequests = useMemo(
    () => (user ? filterOwnRequests(myRequests ?? [], filters) : []),
    [myRequests, filters, user],
  )
  // Se excluyen las propias del listado general para no verlas dos veces.
  const otherRequests = useMemo(
    () => (requests ?? []).filter((r) => r.user_id !== user?.id),
    [requests, user?.id],
  )

  const ownPage = usePagination(ownRequests)
  const othersPage = usePagination(otherRequests)
  const busy = deleteRequest.isPending || updateRequest.isPending

  const brandNames = useMemo(() => new Map((brands ?? []).map((b) => [b.id, b.name])), [brands])
  const categoryNames = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c.name])),
    [categories],
  )

  // Incluye al propio usuario: sus peticiones ya no salen del listado general.
  const authorIds = useMemo(
    () => [...new Set([...(requests ?? []).map((r) => r.user_id), ...(user ? [user.id] : [])])],
    [requests, user],
  )
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
      <Seo
        title="Peticiones"
        description="¿Buscas una maqueta descatalogada o difícil de encontrar? Publica tu petición y deja que otros coleccionistas te ayuden a localizarla."
      />
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
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : ownRequests.length === 0 && otherRequests.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">
            {debouncedSearch || brandId
              ? 'Ninguna petición coincide con tu búsqueda.'
              : 'Todavía no hay peticiones. ¿Buscas algo? Publica la primera.'}
          </p>
        </div>
      ) : (
        <>
          {ownRequests.length > 0 && (
            <section className="mb-10">
              <SectionHeading
                title="Tus peticiones"
                count={ownRequests.length}
                singular="petición"
                plural="peticiones"
              />
              <RequestGrid>
                {ownPage.visible.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    brandName={request.brand_id ? brandNames.get(request.brand_id) : undefined}
                    authorName={nameOf(request.user_id)}
                    authorLocation={authorById.get(request.user_id)?.location}
                    isOwn
                    busy={busy}
                    onOpen={() => setSelected(request)}
                    onDelete={() => deleteRequest.mutate(request.id)}
                    onToggleSuspend={() =>
                      updateRequest.mutate({
                        id: request.id,
                        updates: { status: request.status === 'closed' ? 'open' : 'closed' },
                      })
                    }
                  />
                ))}
              </RequestGrid>
              {ownPage.needsPagination && (
                <Pagination
                  page={ownPage.page}
                  totalPages={ownPage.totalPages}
                  onGoTo={ownPage.goTo}
                  label="Paginación de tus peticiones"
                />
              )}
            </section>
          )}

          {otherRequests.length > 0 && (
            <section>
              <SectionHeading
                title={ownRequests.length > 0 ? 'Todas las peticiones' : 'Peticiones'}
                count={otherRequests.length}
                singular="petición"
                plural="peticiones"
              />
              <RequestGrid>
                {othersPage.visible.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    brandName={request.brand_id ? brandNames.get(request.brand_id) : undefined}
                    authorName={nameOf(request.user_id)}
                    authorLocation={authorById.get(request.user_id)?.location}
                    onOpen={() => setSelected(request)}
                  />
                ))}
              </RequestGrid>
              {othersPage.needsPagination && (
                <Pagination
                  page={othersPage.page}
                  totalPages={othersPage.totalPages}
                  onGoTo={othersPage.goTo}
                  label="Paginación de todas las peticiones"
                />
              )}
            </section>
          )}
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
