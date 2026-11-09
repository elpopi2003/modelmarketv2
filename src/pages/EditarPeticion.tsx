import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useRequest } from '@/hooks/useRequests'
import { RequestForm } from '@/components/marketplace/RequestForm'
import { Card, CardContent } from '@/components/ui/card'

export default function EditarPeticion() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: request, isLoading } = useRequest(id)

  if (isLoading) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </section>
    )
  }

  if (!request) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Petición no encontrada</h1>
        <Link to="/mis-peticiones" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">
          Volver a tus peticiones
        </Link>
      </section>
    )
  }

  if (request.user_id !== user?.id) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold tracking-tight">No puedes editar esta petición</h1>
        <Link to="/mis-peticiones" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">
          Volver a tus peticiones
        </Link>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Editar petición</h1>
      <Card>
        <CardContent className="pt-6">
          <RequestForm mode="edit" request={request} onDone={() => navigate('/mis-peticiones')} />
        </CardContent>
      </Card>
    </section>
  )
}
