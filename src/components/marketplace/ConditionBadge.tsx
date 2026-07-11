import type { ListingCondition } from '@/integrations/supabase/types'
import { CONDITION_LABELS } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Sellos de estado tipo "marca de inspección" (tinte + tinta oscura accesible). */
const CONDITION_STYLES: Record<ListingCondition, string> = {
  new: 'bg-sealed/10 text-sealed-ink border-sealed/30',
  like_new: 'bg-opened/10 text-opened-ink border-opened/30',
  used: 'bg-started/10 text-started-ink border-started/30',
  for_parts: 'bg-muted text-muted-foreground border-border',
}

export function ConditionBadge({
  condition,
  className,
}: {
  condition: ListingCondition
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[0.7rem] font-semibold uppercase tracking-wide',
        CONDITION_STYLES[condition],
        className,
      )}
    >
      {CONDITION_LABELS[condition]}
    </span>
  )
}
