import { Link, useNavigate } from 'react-router-dom'
import { useMyListings } from '@/hooks/useListings'
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits'
import { countsTowardListingLimit } from '@/lib/subscription'
import { ListingForm } from '@/components/marketplace/ListingForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PublicarAnuncio() {
  const navigate = useNavigate()
  const { data: myListings, isLoading } = useMyListings()
  const { canPublishListing, capabilities } = useSubscriptionLimits()

  if (isLoading) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </section>
    )
  }

  // Lo vendido, archivado o retirado no ocupa hueco del plan (misma regla que el servidor).
  const count = (myListings ?? []).filter((l) => countsTowardListingLimit(l.status)).length
  if (!canPublishListing(count)) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Has alcanzado el límite de tu plan</CardTitle>
            <CardDescription>
              El plan {capabilities.label} permite {capabilities.maxListings} anuncio activo y ya
              tienes {count}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Mejora a PRO o Retail para publicar sin límites.
            </p>
            <Button asChild>
              <Link to="/precios">Ver planes</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Publicar anuncio</h1>
      <Card>
        <CardContent className="pt-6">
          <ListingForm mode="create" onDone={() => navigate('/dashboard')} />
        </CardContent>
      </Card>
    </section>
  )
}
