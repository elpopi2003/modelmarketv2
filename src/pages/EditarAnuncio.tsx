import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useListing } from '@/hooks/useListings'
import { ListingForm } from '@/components/marketplace/ListingForm'
import { Card, CardContent } from '@/components/ui/card'

export default function EditarAnuncio() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: listing, isLoading } = useListing(id)

  if (isLoading) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </section>
    )
  }

  if (!listing) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Anuncio no encontrado</h1>
        <Link
          to="/dashboard"
          className="mt-4 inline-block text-primary underline-offset-4 hover:underline"
        >
          Volver al panel
        </Link>
      </section>
    )
  }

  if (listing.user_id !== user?.id) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold tracking-tight">No puedes editar este anuncio</h1>
        <Link
          to="/dashboard"
          className="mt-4 inline-block text-primary underline-offset-4 hover:underline"
        >
          Volver al panel
        </Link>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Editar anuncio</h1>
      <Card>
        <CardContent className="pt-6">
          <ListingForm mode="edit" listing={listing} onDone={() => navigate('/dashboard')} />
        </CardContent>
      </Card>
    </section>
  )
}
