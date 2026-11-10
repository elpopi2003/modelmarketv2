import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Calendar, Camera, MapPin, Package, Save, Target, User } from 'lucide-react'
import { fetchMyListings } from '@/lib/api/listings'
import { fetchMyRequests } from '@/lib/api/requests'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useCustomerPortal, useSubscription } from '@/hooks/useSubscription'
import { profileSchema, type ProfileFormValues } from '@/lib/schemas/profile'
import { DEFAULT_TIER } from '@/lib/subscription'
import { getErrorMessage } from '@/lib/errors'
import { TierBadge } from '@/components/marketplace/TierBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const panel = 'rounded-lg border-2 border-border bg-card p-6 shadow-sm'

/** Convierte '' a null para no chocar con el unique de username y no guardar cadenas vacías. */
function emptyToNull(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** Contadores del usuario: anuncios visibles y peticiones abiertas. */
function useMyStats(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile-stats', userId],
    queryFn: async () => {
      const [listings, requests] = await Promise.all([fetchMyListings(), fetchMyRequests()])
      return {
        listings: listings.filter((l) => l.status === 'active' || l.status === 'reserved').length,
        requests: requests.filter((r) => r.status === 'open').length,
      }
    },
    enabled: Boolean(userId),
  })
}

export default function Perfil() {
  const { user } = useAuth()
  const { profile, isLoading, updateProfile, isUpdating, setAvatar } = useProfile()
  const { data: tier = DEFAULT_TIER } = useSubscription()
  const { data: stats } = useMyStats(user?.id)
  const portal = useCustomerPortal()
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({ resolver: zodResolver(profileSchema) })

  useEffect(() => {
    if (profile) {
      reset({
        display_name: profile.display_name ?? '',
        username: profile.username ?? '',
        location: profile.location ?? '',
        bio: profile.bio ?? '',
      })
    }
  }, [profile, reset])

  const shownName = profile?.display_name || profile?.username || 'Sin nombre'
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
    : '—'

  async function onSubmit(values: ProfileFormValues) {
    setStatus(null)
    try {
      await updateProfile({
        display_name: emptyToNull(values.display_name),
        username: emptyToNull(values.username),
        location: emptyToNull(values.location),
        bio: emptyToNull(values.bio),
      })
      setStatus({ kind: 'ok', message: 'Perfil guardado.' })
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) })
    }
  }

  async function onPickAvatar(list: FileList | null) {
    const file = list?.[0]
    if (!file) return
    setStatus(null)
    setAvatarBusy(true)
    try {
      await setAvatar(file)
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setAvatarBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (isLoading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link
        to="/dashboard"
        className="mb-8 inline-flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide text-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4" /> Volver al dashboard
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,1fr)_2fr]">
        {/* Columna izquierda: identidad + estadísticas */}
        <div className="space-y-6">
          <div className={`${panel} text-center`}>
            <div className="relative mx-auto size-28">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="size-28 rounded-full border-2 border-border object-cover"
                />
              ) : (
                <span className="grid size-28 place-items-center rounded-full bg-primary font-display text-4xl font-extrabold text-primary-foreground">
                  {shownName.charAt(0).toUpperCase()}
                </span>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={avatarBusy}
                aria-label="Cambiar foto de perfil"
                className="absolute -bottom-1 -right-1 grid size-10 place-items-center rounded-full bg-accent text-accent-foreground shadow-md transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Camera className="size-5" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickAvatar(e.target.files)}
              />
            </div>

            <h1 className="mt-4 font-display text-xl font-extrabold">{shownName}</h1>
            {user?.email && <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>}
            <div className="mt-3 flex justify-center">
              <TierBadge tier={tier} />
            </div>
          </div>

          <div className={panel}>
            <h2 className="mb-4 font-display text-base font-extrabold">Estadísticas</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Package className="size-4" /> Anuncios activos
                </dt>
                <dd className="mm-mono font-bold">{stats?.listings ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Target className="size-4" /> Peticiones activas
                </dt>
                <dd className="mm-mono font-bold">{stats?.requests ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="size-4" /> Miembro desde
                </dt>
                <dd className="mm-mono font-bold">{memberSince}</dd>
              </div>
            </dl>
          </div>

          <div className={panel}>
            <h2 className="mb-3 font-display text-base font-extrabold">Suscripción</h2>
            {tier === 'free' ? (
              <Button asChild variant="accent" size="sm" className="w-full">
                <Link to="/precios">Mejorar plan</Link>
              </Button>
            ) : (
              <Button
                size="sm"
                className="w-full"
                disabled={portal.isPending}
                onClick={() =>
                  portal.mutate(undefined, {
                    onError: (e) => setStatus({ kind: 'error', message: getErrorMessage(e) }),
                  })
                }
              >
                {portal.isPending ? 'Abriendo…' : 'Gestionar suscripción'}
              </Button>
            )}
          </div>
        </div>

        {/* Columna derecha: información editable */}
        <div className={panel}>
          <h2 className="mb-6 flex items-center gap-2 font-display text-xl font-extrabold">
            <User className="size-5" /> Información del Perfil
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="display_name">Nombre para mostrar</Label>
                <Input id="display_name" {...register('display_name')} />
                {errors.display_name && (
                  <p className="text-sm text-destructive">{errors.display_name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Nombre de usuario</Label>
                <Input id="username" placeholder="p. ej. escala_1_72" {...register('username')} />
                {errors.username && (
                  <p className="text-sm text-destructive">{errors.username.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="location"
                  placeholder="p. ej. 45003, Toledo"
                  className="pl-9"
                  {...register('location')}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Esta ubicación aparecerá en tus anuncios y peticiones
              </p>
              {errors.location && (
                <p className="text-sm text-destructive">{errors.location.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Biografía</Label>
              <Textarea
                id="bio"
                rows={5}
                placeholder="Cuéntanos sobre ti y tu pasión por el modelismo…"
                {...register('bio')}
              />
              <p className="text-xs text-muted-foreground">Máximo 500 caracteres</p>
              {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
            </div>

            {status && (
              <p
                className={
                  status.kind === 'ok'
                    ? 'text-sm text-muted-foreground'
                    : 'text-sm text-destructive'
                }
              >
                {status.message}
              </p>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={isUpdating}>
                <Save />
                {isUpdating ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
