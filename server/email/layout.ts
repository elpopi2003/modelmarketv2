/**
 * Maquetado común de los emails "Blueprint / Industrial" de ModelMarket.
 *
 * Portado de supabase/functions/_shared/email-layout.ts con dos cambios:
 *  - El logo y el origen de los enlaces vienen de la configuración (MAIL_LOGO_URL, APP_URL).
 *  - Cada email lleva también versión de texto plano: los filtros anti-spam penalizan el
 *    HTML sin alternativa, y algunos lectores solo muestran texto.
 */

export interface EmailContent {
  subject: string
  html: string
  text: string
}

export interface LayoutOptions {
  subject: string
  heading: string
  intro?: string
  /** Párrafos HTML. Lo que venga de una persona debe pasar antes por escapeHtml(). */
  paragraphs?: string[]
  /** `href` absoluto o ruta de la app (`/auth/...`), que se completa con APP_URL. */
  cta?: { label: string; href: string }
  footNote?: string
}

export interface LayoutContext {
  appUrl: string
  logoUrl: string
}

/**
 * Escapa texto que va a incrustarse en el HTML del email. Lo que escribe una persona
 * (el motivo de una suspensión, un mensaje) no puede entrar tal cual: un `<` suelto rompe
 * el correo y una etiqueta llegaría viva.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** HTML de un párrafo → texto legible (quita etiquetas y deshace entidades). */
function toText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

const absolute = (href: string, appUrl: string) =>
  /^https?:\/\//.test(href) ? href : `${appUrl}${href}`

// Cabecera con banda BLANCA: el logotipo es azul marino sobre transparente y sobre azul
// resultaba ilegible. La franja naranja inferior conserva el acento de marca. El `alt`
// está cuidado porque muchos clientes bloquean imágenes: si no carga, se lee el nombre.
export function layout(opts: LayoutOptions, ctx: LayoutContext): EmailContent {
  const paras = (opts.paragraphs ?? [])
    .map((p) => `<p style="margin:0 0 14px;color:#1A2733;font-size:15px;line-height:1.6;">${p}</p>`)
    .join('')
  const ctaHref = opts.cta ? escapeHtml(absolute(opts.cta.href, ctx.appUrl)) : ''
  const cta = opts.cta
    ? `<div style="margin:22px 0 6px;"><a href="${ctaHref}" style="display:inline-block;background:#1B3A5F;color:#ffffff;text-decoration:none;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:12px 24px;border-radius:6px;font-family:Arial,sans-serif;font-size:14px;">${opts.cta.label}</a></div>`
    : ''

  const html = `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.subject)}</title></head>
  <body style="margin:0;background:#F4F6F9;padding:24px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:2px solid #E1E7EF;border-radius:6px;overflow:hidden;box-shadow:4px 4px 0 0 #E1E7EF;">
      <div style="background:#ffffff;padding:20px 24px 16px;border-bottom:3px solid #F7941D;">
        <img src="${escapeHtml(ctx.logoUrl)}" alt="ModelMarket" width="220"
             style="display:block;border:0;outline:none;text-decoration:none;width:220px;max-width:100%;height:auto;" />
      </div>
      <div style="padding:24px;">
        <h1 style="margin:0 0 12px;color:#1B3A5F;font-size:20px;line-height:1.3;">${opts.heading}</h1>
        ${opts.intro ? `<p style="margin:0 0 14px;color:#1A2733;font-size:15px;line-height:1.6;">${opts.intro}</p>` : ''}
        ${paras}
        ${cta}
        ${opts.footNote ? `<p style="margin:18px 0 0;color:#5B6B7B;font-size:12px;line-height:1.5;">${opts.footNote}</p>` : ''}
      </div>
      <div style="background:#F9FAFB;border-top:1px solid #E1E7EF;padding:14px 24px;color:#5B6B7B;font-size:12px;">
        ModelMarket — Nada de comisiones, sólo maquetas.
      </div>
    </div>
  </body>
</html>`

  const text = [
    toText(opts.heading),
    opts.intro && toText(opts.intro),
    ...(opts.paragraphs ?? []).map(toText),
    opts.cta && `${toText(opts.cta.label)}: ${absolute(opts.cta.href, ctx.appUrl)}`,
    opts.footNote && toText(opts.footNote),
    '--\nModelMarket — Nada de comisiones, sólo maquetas.',
  ]
    .filter(Boolean)
    .join('\n\n')

  return { subject: opts.subject, html, text }
}
