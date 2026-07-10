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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-5">
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
              to="/perfil"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Perfil
            </Link>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {user?.email && <span className="text-muted-foreground">{user.email}</span>}
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
