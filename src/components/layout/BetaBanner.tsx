import { AlertTriangle } from 'lucide-react'

const PHRASE =
  'Plataforma en fase beta — Estamos en periodo de pruebas. Algunas funcionalidades pueden no estar disponibles o presentar cambios.'

/** Una pista del marquee: la frase repetida para llenar el ancho del viewport. */
function Track() {
  return (
    <span className="mm-marquee-track" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <span
          key={i}
          className="mm-mono flex shrink-0 items-center gap-2 px-6 text-[0.7rem] font-semibold uppercase tracking-wider"
        >
          <AlertTriangle className="size-3.5 shrink-0" />
          {PHRASE}
        </span>
      ))}
    </span>
  )
}

/**
 * Cinta superior de aviso "fase beta". Dos pistas idénticas se desplazan en bucle
 * (marquee). Con `prefers-reduced-motion` el guard global congela la animación y el
 * texto queda estático y legible.
 */
export function BetaBanner() {
  return (
    <div
      className="flex overflow-hidden bg-accent py-1.5 text-accent-ink"
      role="status"
      aria-label={PHRASE}
    >
      <Track />
      <Track />
    </div>
  )
}
