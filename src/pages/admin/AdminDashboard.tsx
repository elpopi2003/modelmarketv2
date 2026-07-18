import { Link } from 'react-router-dom'
import { Flag, Package, Tag, Target, Users, type LucideIcon } from 'lucide-react'
import { useAdminStats } from '@/hooks/useAdmin'
import { AdminNav } from '@/components/admin/AdminNav'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function StatCard({
  Icon,
  tone,
  value,
  label,
  highlight = false,
}: {
  Icon: LucideIcon
  tone: string
  value: number | undefined
  label: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border-2 bg-card p-5 shadow-sm',
        highlight && value ? 'border-accent' : 'border-border',
      )}
    >
      <span className={cn('grid size-10 place-items-center rounded-lg', tone)}>
        <Icon className="size-5" />
      </span>
      <p className="mm-mono mt-3 text-3xl font-bold">{value ?? '—'}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

export default function AdminDashboard() {
  const { data: stats, isLoading, error } = useAdminStats()

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <AdminNav />
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Administración</h1>
      <p className="mt-1 text-muted-foreground">Estado general de la plataforma.</p>

      {error ? (
        <p className="mt-6 rounded-lg border-2 border-destructive/60 bg-destructive/10 p-4 text-sm text-destructive">
          No se pudieron cargar las estadísticas.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            Icon={Users}
            tone="bg-primary/10 text-primary"
            value={isLoading ? undefined : stats?.users}
            label="Usuarios"
          />
          <StatCard
            Icon={Package}
            tone="bg-sealed/10 text-sealed"
            value={isLoading ? undefined : stats?.listings}
            label="Anuncios visibles"
          />
          <StatCard
            Icon={Target}
            tone="bg-started/10 text-started"
            value={isLoading ? undefined : stats?.requests}
            label="Peticiones abiertas"
          />
          <StatCard
            Icon={Tag}
            tone="bg-opened/10 text-opened"
            value={isLoading ? undefined : stats?.offers}
            label="Ofertas pendientes"
          />
          <StatCard
            Icon={Flag}
            tone="bg-destructive/10 text-destructive"
            value={isLoading ? undefined : stats?.reports_pending}
            label="Reportes pendientes"
            highlight
          />
        </div>
      )}

      <div className="mt-8">
        <Button asChild variant={stats?.reports_pending ? 'accent' : 'outline'}>
          <Link to="/admin/reportes">
            <Flag /> Ir a moderación
            {stats?.reports_pending ? ` (${stats.reports_pending})` : ''}
          </Link>
        </Button>
      </div>
    </section>
  )
}
