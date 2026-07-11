import { Heart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useMyFavoriteIds, useToggleFavorite } from '@/hooks/useFavorites'
import { cn } from '@/lib/utils'

/**
 * Botón corazón para marcar/desmarcar favoritos. Diseñado para vivir sobre un `<Link>`
 * (se posiciona como hermano, no anidado, para no romper la semántica del enlace).
 * Sin sesión, lleva a /auth.
 */
export function FavoriteButton({
  listingId,
  className,
  withLabel = false,
}: {
  listingId: string
  className?: string
  withLabel?: boolean
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: favoriteIds } = useMyFavoriteIds()
  const toggle = useToggleFavorite()

  const isFavorited = favoriteIds?.includes(listingId) ?? false

  function handleClick(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (!user) {
      navigate('/auth')
      return
    }
    toggle.mutate({ listingId, isFavorited })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={toggle.isPending}
      aria-pressed={isFavorited}
      aria-label={isFavorited ? 'Quitar de favoritos' : 'Añadir a favoritos'}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border border-border bg-card/90 px-2.5 py-2 text-sm font-medium shadow-sm backdrop-blur-sm transition-colors hover:text-accent disabled:opacity-50',
        isFavorited && 'text-accent',
        className,
      )}
    >
      <Heart className={cn('size-5', isFavorited && 'fill-current')} />
      {withLabel && <span>{isFavorited ? 'Guardado' : 'Guardar'}</span>}
    </button>
  )
}
