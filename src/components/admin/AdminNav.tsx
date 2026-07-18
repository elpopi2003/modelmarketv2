import { NavLink } from 'react-router-dom'
import { Flag, LayoutDashboard, Package, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/admin', label: 'Resumen', Icon: LayoutDashboard, end: true },
  { to: '/admin/reportes', label: 'Moderación', Icon: Flag, end: false },
  { to: '/admin/usuarios', label: 'Usuarios', Icon: Users, end: false },
  { to: '/admin/contenido', label: 'Contenido', Icon: Package, end: false },
]

/** Navegación entre secciones del panel de administración. */
export function AdminNav() {
  return (
    <nav className="mb-8 flex flex-wrap gap-1 rounded-lg border-2 border-border bg-card p-1">
      {LINKS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 font-display text-sm font-extrabold uppercase tracking-wide transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
