import { BookImage } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Etiqueta para la foto de catálogo (la caja oficial del fabricante): avisa al comprador
 * de que no es una foto real del artículo que se vende.
 */
export function CatalogPhotoBadge({ className }: { className?: string }) {
  return (
    <span
      title="Imagen oficial de la caja, no una foto real de este artículo. Pregunta al vendedor por el estado."
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border bg-card/95 px-2 py-0.5 font-mono text-[0.7rem] font-bold uppercase tracking-wide text-foreground shadow-sm',
        className,
      )}
    >
      <BookImage className="size-3 shrink-0" aria-hidden />
      Foto de catálogo
    </span>
  )
}
