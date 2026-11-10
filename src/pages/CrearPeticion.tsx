import { Link, useNavigate } from 'react-router-dom'
import { useMyRequests } from '@/hooks/useRequests'
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits'
import { countsTowardRequestLimit } from '@/lib/subscription'
import { RequestForm } from '@/components/marketplace/RequestForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function CrearPeticion() {
  const navigate = useNavigate()
  const { data: myRequests, isLoading } = useMyRequests()
  const { canCreateRequest, capabilities } = useSubscriptionLimits()

  if (isLoading) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </section>
    )
  }

  // Las cumplidas o cerradas no ocupan hueco del plan (misma regla que el servidor).
  const count = (myRequests ?? []).filter((r) => countsTowardRequestLimit(r.status)).length
  if (!canCreateRequest(count)) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Has alcanzado el límite de tu plan</CardTitle>
            <CardDescription>
              El plan {capabilities.label} permite {capabilities.maxRequests} petición activa y ya
              tienes {count}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Mejora a PRO o Retail para publicar peticiones sin límite.
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
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Crear petición</h1>
      <Card>
        <CardContent className="pt-6">
          <RequestForm mode="create" onDone={() => navigate('/mis-peticiones')} />
        </CardContent>
      </Card>
    </section>
  )
}
