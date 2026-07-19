import { useMemo, useState } from 'react'
import { Flag, MapPin, Package, Search, Shield, ShieldOff, Target, Trash2, Users } from 'lucide-react'
import { useAdminUsers, useDeleteUserAsAdmin, useSetUserAdmin } from '@/hooks/useAdmin'
import { useAuth } from '@/hooks/useAuth'
import type { AdminUser } from '@/lib/api/admin'
import { getErrorMessage } from '@/lib/errors'
import { TierBadge } from '@/components/marketplace/TierBadge'
import { AdminNav } from '@/components/admin/AdminNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { matchesSearch } from '@/lib/utils'

function UserRow({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const setAdmin = useSetUserAdmin()
  const deleteUser = useDeleteUserAsAdmin()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const name = user.display_name || user.username || 'Sin nombre'

  function run(action: () => Promise<unknown>) {
    setError(null)
    action().catch((e) => setError(getErrorMessage(e)))
  }

  return (
    <div className="rounded-lg border-2 border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              loading="lazy"
              className="size-11 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary font-display font-extrabold text-primary-foreground">
              {name.charAt(0).toUpperCase()}
            </span>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold">{name}</p>
              <TierBadge tier={user.tier} />
              {user.is_admin && (
                <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[0.7rem] font-semibold uppercase text-primary">
                  <Shield className="size-3" /> Admin
                </span>
              )}
              {isSelf && (
                <span className="mm-mono text-[0.7rem] uppercase text-muted-foreground">(tú)</span>
              )}
            </div>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            {user.location && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" /> {user.location}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-4 text-center">
          <div>
            <p className="mm-mono text-lg font-bold">{user.listings_count}</p>
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Package className="size-3" /> anuncios
            </p>
          </div>
          <div>
            <p className="mm-mono text-lg font-bold">{user.requests_count}</p>
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Target className="size-3" /> peticiones
            </p>
          </div>
          <div>
            <p
              className={
                user.reports_count > 0
                  ? 'mm-mono text-lg font-bold text-destructive'
                  : 'mm-mono text-lg font-bold'
              }
            >
              {user.reports_count}
            </p>
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Flag className="size-3" /> denuncias
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {user.is_admin ? (
          <Button
            variant="outline"
            size="sm"
            disabled={setAdmin.isPending || isSelf}
            title={isSelf ? 'No puedes retirarte el rol a ti mismo' : undefined}
            onClick={() => run(() => setAdmin.mutateAsync({ userId: user.id, makeAdmin: false }))}
          >
            <ShieldOff /> Quitar admin
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={setAdmin.isPending}
            onClick={() => run(() => setAdmin.mutateAsync({ userId: user.id, makeAdmin: true }))}
          >
            <Shield /> Hacer admin
          </Button>
        )}

        {!isSelf &&
          (confirming ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteUser.isPending}
                onClick={() => run(() => deleteUser.mutateAsync(user.id))}
              >
                {deleteUser.isPending ? 'Eliminando…' : 'Confirmar borrado'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
              <Trash2 /> Eliminar cuenta
            </Button>
          ))}
      </div>

      {confirming && (
        <p className="mt-2 text-xs text-muted-foreground">
          Se borrarán también sus anuncios, peticiones, ofertas y mensajes. No se puede deshacer.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}

export default function AdminUsuarios() {
  const { user } = useAuth()
  const { data: users, isLoading, error } = useAdminUsers()
  const [search, setSearch] = useState('')

  const filtrados = useMemo(
    () =>
      (users ?? []).filter((u) =>
        matchesSearch(search, [u.email, u.display_name, u.username, u.location]),
      ),
    [users, search],
  )

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <AdminNav />

      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
        <Users className="size-7" /> Usuarios
      </h1>
      <p className="mt-1 text-muted-foreground">
        {users
          ? search
            ? `${filtrados.length} de ${users.length} ${users.length === 1 ? 'cuenta' : 'cuentas'}`
            : `${users.length} ${users.length === 1 ? 'cuenta' : 'cuentas'}`
          : 'Cargando…'}
      </p>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          className="pl-9"
          placeholder="Buscar por email, nombre, usuario o ubicación…"
          aria-label="Buscar usuarios"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error ? (
        <p className="mt-6 rounded-lg border-2 border-destructive/60 bg-destructive/10 p-4 text-sm text-destructive">
          No se pudo cargar el listado.
        </p>
      ) : isLoading ? (
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="mt-6 rounded-lg border-2 border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">
            Ningún usuario coincide con «{search}».
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {filtrados.map((u) => (
            <UserRow key={u.id} user={u} isSelf={u.id === user?.id} />
          ))}
        </div>
      )}
    </section>
  )
}
