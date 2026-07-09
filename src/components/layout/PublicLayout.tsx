import { Link, Outlet } from 'react-router-dom'

/** Shell público: cabecera + contenido (Outlet) + pie. Rutas no autenticadas. */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-bold tracking-tight">
            ModelMarket
          </Link>
          <nav className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link to="/explorar" className="transition-colors hover:text-foreground">
              Explorar
            </Link>
            <Link to="/peticiones" className="transition-colors hover:text-foreground">
              Peticiones
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} ModelMarket — 0% de comisión entre coleccionistas.
        </div>
      </footer>
    </div>
  )
}
