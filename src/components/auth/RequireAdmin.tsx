import { Link, Outlet } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useIsAdmin } from '@/hooks/useAdmin'
import { Button } from '@/components/ui/button'

/**
 * Guard de las rutas /admin. Se monta dentro de RequireAuth, así que aquí ya hay sesión.
 *
 * Es una barrera de UI: evita enseñar el panel a quien no toca. La barrera real está en
 * la base de datos (policies con has_role + RPCs que comprueban el rol), así que ocultar
 * esto no es lo que protege los datos.
 */
export function RequireAdmin() {
  const { isAdmin, isLoading } = useIsAdmin()

  if (isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">
        Comprobando permisos…
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <section className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
        <ShieldAlert className="mx-auto mb-4 size-10 text-muted-foreground" />
        <h1 className="text-2xl font-extrabold tracking-tight">Zona restringida</h1>
        <p className="mt-2 text-muted-foreground">
          Esta sección es solo para administradores de ModelMarket.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/dashboard">Volver al panel</Link>
        </Button>
      </section>
    )
  }

  return <Outlet />
}
