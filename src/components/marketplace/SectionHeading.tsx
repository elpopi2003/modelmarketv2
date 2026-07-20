/**
 * Cabecera de bloque en los listados ("Tus peticiones", "Todas las peticiones"),
 * con el recuento a la derecha.
 *
 * El plural se pasa explícito en vez de derivarlo: en español no basta con añadir una -s
 * ("petición" → "peticiones" pierde la tilde).
 */
export function SectionHeading({
  title,
  count,
  singular,
  plural,
}: {
  title: string
  count: number
  singular: string
  plural: string
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-border pb-2">
      <h2 className="font-display text-xl font-extrabold uppercase tracking-wide text-foreground">
        {title}
      </h2>
      <p className="mm-mono text-sm text-muted-foreground">
        {count} {count === 1 ? singular : plural}
      </p>
    </div>
  )
}
