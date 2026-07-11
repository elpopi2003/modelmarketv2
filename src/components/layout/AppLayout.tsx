import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

/** Shell autenticado: cabecera con identidad + logout. Se usa tras el guard RequireAuth. */
export function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link to="/dashboard" className="text-lg font-bold tracking-tight">
              ModelMarket
            </Link>
            <Link
              to="/publicar"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Publicar
            </Link>
            <Link
              to="/mis-peticiones"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Mis peticiones
            </Link>
            <Link
              to="/favoritos"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Favoritos
            </Link>
            <Link
              to="/perfil"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Perfil
            </Link>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {user?.email && (
              <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
