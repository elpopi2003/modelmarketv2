import type { ComponentType } from 'react'
import { Hammer, Package, PackageOpen } from 'lucide-react'
import type { ListingCondition } from '@/integrations/supabase/types'
import { CONDITION_LABELS } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Sello de estado del artículo: pastilla sólida + icono, en mono y mayúsculas.
 * Los colores salen de los tokens de estado (sealed / opened / started).
 */
const CONDITION_STYLES: Record<
  ListingCondition,
  { className: string; Icon: ComponentType<{ className?: string }> }
> = {
  sealed: { className: 'bg-sealed text-sealed-foreground', Icon: Package },
  opened: { className: 'bg-opened text-opened-foreground', Icon: PackageOpen },
  started: { className: 'bg-started text-started-foreground', Icon: Hammer },
}

export function ConditionBadge({
  condition,
  className,
}: {
  condition: ListingCondition
  className?: string
}) {
  const { className: tone, Icon } = CONDITION_STYLES[condition]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-transparent px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide',
        tone,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" />
      {CONDITION_LABELS[condition]}
    </span>
  )
}
