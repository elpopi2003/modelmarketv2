import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDeleteRequest, useMyRequests } from '@/hooks/useRequests'
import { formatPrice, REQUEST_STATUS_LABELS } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'

export default function MisPeticiones() {
  const { data: requests, isLoading } = useMyRequests()
  const deleteRequest = useDeleteRequest()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setError(null)
    try {
      await deleteRequest.mutateAsync(id)
      setConfirmId(null)
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Tus peticiones</h1>
        <Button asChild>
          <Link to="/crear-peticion">Crear petición</Link>
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !requests || requests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Aún no has publicado ninguna petición.</p>
          <Button asChild className="mt-4">
            <Link to="/crear-peticion">Crea la primera</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">{request.title}</p>
                <p className="text-sm text-muted-foreground">
                  {request.max_price_cents != null
                    ? `Hasta ${formatPrice(request.max_price_cents)}`
                    : 'Sin presupuesto'}{' '}
                  · {REQUEST_STATUS_LABELS[request.status]}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to={`/peticion/${request.id}/editar`}>Editar</Link>
                </Button>
                {confirmId === request.id ? (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteRequest.isPending}
                      onClick={() => handleDelete(request.id)}
                    >
                      {deleteRequest.isPending ? 'Borrando…' : 'Sí, borrar'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>
                      No
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmId(request.id)}>
                    Borrar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
