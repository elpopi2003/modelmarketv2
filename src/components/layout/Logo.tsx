import { cn } from '@/lib/utils'

/**
 * Emblema provisional (rombo naranja sobre placa azul). Sustituir por el logo real
 * de ModelMarket cuando esté disponible como SVG.
 */
function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-md bg-primary', className)}>
      <span className="size-2.5 rotate-45 rounded-[2px] bg-accent" />
    </span>
  )
}

/** Marca de ModelMarket: emblema + logotipo bicolor + claim técnico opcional. */
export function Logo({
  className,
  showTagline = true,
}: {
  className?: string
  showTagline?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="size-9" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-extrabold tracking-tight text-foreground">
          Model<span className="text-muted-foreground">Market</span>
        </span>
        {showTagline && (
          <span className="mm-mono mt-1 text-[0.5rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Nada de comisiones · Solo maquetas
          </span>
        )}
      </span>
    </span>
  )
}
