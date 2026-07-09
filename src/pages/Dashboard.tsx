import { useAuth } from '@/hooks/useAuth'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Panel</h1>
      <p className="mt-2 text-muted-foreground">
        Hola{user?.email ? `, ${user.email}` : ''}. Tu actividad (anuncios, peticiones, mensajes)
        aparecerá aquí a partir de M3.
      </p>
    </section>
  )
}
