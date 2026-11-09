import type { ReactNode } from 'react'
import { Seo } from '@/components/seo/Seo'

/** Una sección numerada del documento. */
export interface LegalSection {
  title: string
  /** Párrafos introductorios, antes de la lista. */
  paragraphs?: string[]
  /** Puntos en lista. */
  list?: string[]
  /** Párrafos de cierre, después de la lista. */
  after?: string[]
  /** Contenido libre (tablas, etc.). */
  extra?: ReactNode
}

/**
 * Maquetación común de los documentos legales (Términos, Privacidad, Cookies).
 * Ancho de lectura acotado y jerarquía tipográfica del design system.
 */
export function LegalDoc({
  title,
  lastUpdated,
  sections,
  footer,
}: {
  title: string
  lastUpdated: string
  sections: LegalSection[]
  footer?: ReactNode
}) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Seo
        title={title}
        description={`${title} de ModelMarket. Última actualización: ${lastUpdated}.`}
      />
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mm-mono mt-2 text-xs uppercase tracking-wider text-muted-foreground">
        Última actualización: {lastUpdated}
      </p>

      <div className="mt-10 space-y-10">
        {sections.map((section, index) => (
          <div key={section.title}>
            <h2 className="font-display text-lg font-extrabold text-foreground">
              {index + 1}. {section.title}
            </h2>

            {section.paragraphs?.map((p) => (
              <p key={p} className="mt-3 leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}

            {section.list && (
              <ul className="mt-3 space-y-2">
                {section.list.map((item) => (
                  <li key={item} className="flex gap-2.5 leading-relaxed text-muted-foreground">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}

            {section.extra && <div className="mt-4">{section.extra}</div>}

            {section.after?.map((p) => (
              <p key={p} className="mt-3 leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </div>
        ))}
      </div>

      {footer && (
        <p className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">{footer}</p>
      )}
    </section>
  )
}
