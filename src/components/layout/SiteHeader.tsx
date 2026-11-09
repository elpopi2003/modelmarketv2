import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  Bell,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Shield,
  Tag,
  User as UserIcon,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useUnreadCount } from '@/hooks/useMessages'
import { useUnreadNotificationCount } from '@/hooks/useNotifications'
import { useIsAdmin } from '@/hooks/useAdmin'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/layout/Logo'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { to: '/explorar', label: 'Explorar' },
  { to: '/peticiones', label: 'Peticiones' },
  { to: '/precios', label: 'Precios' },
]

const iconButton =
  'relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function CountBadge({ children }: { children: ReactNode }) {
  return (
    <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 py-0.5 text-[0.6rem] font-bold leading-none text-accent-ink ring-2 ring-card">
      {children}
    </span>
  )
}

/** Cabecera global. Idéntica en rutas públicas y privadas; el contenido de la derecha
 *  se adapta al estado de sesión (invitado vs. autenticado). */
export function SiteHeader() {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to={user ? '/dashboard' : '/'} aria-label="ModelMarket — inicio">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'text-sm font-bold uppercase tracking-wide transition-colors hover:text-accent',
                  isActive ? 'text-accent' : 'text-foreground/85',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {user ? <AuthedActions /> : <GuestActions />}
      </div>
    </header>
  )
}

function GuestActions() {
  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <Link to="/explorar" aria-label="Buscar" className={cn(iconButton, 'hidden sm:inline-flex')}>
        <Search className="size-5" />
      </Link>
      <Link to="/auth" aria-label="Entrar o registrarse" title="Entrar" className={iconButton}>
        <UserIcon className="size-5" />
      </Link>
      <Button asChild variant="accent" size="sm" className="ml-1">
        <Link to="/publicar">
          <Plus /> Publicar
        </Link>
      </Button>
    </div>
  )
}

function AuthedActions() {
  const { user, signOut } = useAuth()
  const { data: unreadMsg } = useUnreadCount()
  const { data: unreadNotif } = useUnreadNotificationCount()
  const { isAdmin } = useIsAdmin()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    navigate('/', { replace: true })
  }

  const initial = (user?.email?.[0] ?? 'U').toUpperCase()

  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <Link to="/favoritos" aria-label="Favoritos" className={iconButton}>
        <Heart className="size-5" />
      </Link>
      <Link to="/explorar" aria-label="Buscar" className={cn(iconButton, 'hidden sm:inline-flex')}>
        <Search className="size-5" />
      </Link>
      <Link to="/mensajes" aria-label="Mensajes" className={iconButton}>
        <MessageSquare className="size-5" />
        {unreadMsg ? <CountBadge>{unreadMsg}</CountBadge> : null}
      </Link>

      <Button asChild variant="accent" size="sm" className="ml-1 hidden sm:inline-flex">
        <Link to="/publicar">
          <Plus /> Publicar
        </Link>
      </Button>

      <div className="relative ml-1" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Menú de cuenta"
          className="relative inline-flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          {initial}
          {unreadNotif ? (
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-accent ring-2 ring-card" />
          ) : null}
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-lg"
          >
            <MenuItem
              to="/dashboard"
              icon={<LayoutDashboard className="size-4" />}
              onNavigate={() => setOpen(false)}
            >
              Mi panel
            </MenuItem>
            <MenuItem
              to="/ofertas"
              icon={<Tag className="size-4" />}
              onNavigate={() => setOpen(false)}
            >
              Ofertas
            </MenuItem>
            <MenuItem
              to="/perfil"
              icon={<UserIcon className="size-4" />}
              onNavigate={() => setOpen(false)}
            >
              Mi perfil
            </MenuItem>
            <MenuItem
              to="/configuracion"
              icon={<Settings className="size-4" />}
              onNavigate={() => setOpen(false)}
            >
              Configuración
            </MenuItem>
            <MenuItem
              to="/notificaciones"
              icon={<Bell className="size-4" />}
              badge={unreadNotif || undefined}
              onNavigate={() => setOpen(false)}
            >
              Notificaciones
            </MenuItem>
            {isAdmin && (
              <>
                <div className="my-1 h-px bg-border" />
                <MenuItem
                  to="/admin"
                  icon={<Shield className="size-4" />}
                  onNavigate={() => setOpen(false)}
                >
                  Administración
                </MenuItem>
              </>
            )}
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function MenuItem({
  to,
  icon,
  badge,
  children,
  onNavigate,
}: {
  to: string
  icon: ReactNode
  badge?: number
  children: ReactNode
  onNavigate: () => void
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onNavigate}
      className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
    >
      {icon}
      <span className="flex-1">{children}</span>
      {badge ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[0.65rem] font-bold text-accent-ink">
          {badge}
        </span>
      ) : null}
    </Link>
  )
}
