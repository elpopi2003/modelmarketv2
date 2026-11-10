import { escapeHtml, layout, type EmailContent, type LayoutContext } from '../layout'

/**
 * Email de un aviso de la campanita (mensaje, oferta, favorito…). El título y el texto
 * pueden contener lo que escribió otra persona (un mensaje, una oferta), así que se
 * escapan siempre.
 */
export function notificationEmail(
  p: { title: string; body?: string | null; link?: string | null },
  ctx: LayoutContext,
): EmailContent {
  return layout(
    {
      subject: p.title,
      heading: escapeHtml(p.title),
      paragraphs: p.body ? [escapeHtml(p.body)] : [],
      cta: p.link ? { label: 'Abrir en ModelMarket', href: p.link } : undefined,
      footNote: 'Puedes desactivar estos avisos en Configuración → Notificaciones.',
    },
    ctx,
  )
}
