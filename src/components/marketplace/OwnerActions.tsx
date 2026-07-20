import { useState } from 'react'
import { Eye, EyeOff, ShieldAlert, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Acciones del dueño sobre su propio contenido: suspender (reversible) y eliminar (no).
 *
 * Se envuelve en un contenedor que corta la propagación porque ambas tarjetas son
 * clicables enteras: pulsar "Eliminar" no debe abrir además el detalle.
 */
export function OwnerActions({
  suspended,
  moderated = false,
  onToggleSuspend,
  onDelete,
  cascadeNote,
  busy = false,
  align = 'start',
}: {
  suspended: boolean
  /**
   * Retirado por un administrador, no suspendido por su dueño. No se ofrece reactivar:
   * la base de datos lo rechaza, así que el botón solo serviría para dar un error.
   */
  moderated?: boolean
  onToggleSuspend: () => void
  onDelete: () => void
  /** Qué se lleva por delante el borrado, en una frase. */
  cascadeNote: string
  busy?: boolean
  align?: 'start' | 'end'
}) {
  const [confirming, setConfirming] = useState(false)

  // Retirado por un administrador: la moderación tiene prioridad sobre el dueño, así que
  // no se ofrece ni reactivar ni eliminar. Ambas las rechaza la base de datos; mostrarlas
  // solo serviría para dar un error, y ocultar el motivo sería peor.
  if (moderated) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className={cn(
          'flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5',
          align === 'end' && 'justify-end text-right',
        )}
      >
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-destructive">Retirado por moderación.</span> Solo un
          administrador puede restaurarlo o eliminarlo. Si crees que es un error, escríbenos desde{' '}
          <a href="/contacto" className="underline underline-offset-2 hover:text-foreground">
            contacto
          </a>
          .
        </p>
      </div>
    )
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn('flex flex-col gap-2', align === 'end' ? 'items-end' : 'items-start')}
    >
      {confirming ? (
        <>
          <p
            className={cn(
              'max-w-[16rem] text-xs text-muted-foreground',
              align === 'end' && 'text-right',
            )}
          >
            {cascadeNote} No se puede deshacer.
          </p>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" disabled={busy} onClick={onDelete}>
              Sí, eliminar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={onToggleSuspend}>
            {suspended ? (
              <>
                <Eye /> Reactivar
              </>
            ) : (
              <>
                <EyeOff /> Suspender
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setConfirming(true)}
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <Trash2 /> Eliminar
          </Button>
        </div>
      )}
    </div>
  )
}
