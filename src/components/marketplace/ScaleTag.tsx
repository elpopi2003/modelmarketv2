import { cn } from '@/lib/utils'

/** Chip monoespaciado para la escala del modelo (1/72, 1/35, …). */
export function ScaleTag({ scale, className }: { scale: string; className?: string }) {
  return <span className={cn('mm-scale-tag', className)}>{scale}</span>
}
