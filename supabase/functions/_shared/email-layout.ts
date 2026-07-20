// Maquetado común de los emails "Blueprint / Industrial" de ModelMarket.
//
// Vive aparte de `email-templates.ts` para que una función que solo necesita una plantilla
// no tenga que arrastrar todas las demás al desplegarse.

function appUrl(): string {
  return Deno.env.get('APP_URL') ?? 'https://modelmarket.es'
}

export interface LayoutOptions {
  heading: string
  intro?: string
  paragraphs?: string[]
  cta?: { label: string; path: string }
  footNote?: string
}

export interface EmailContent {
  subject: string
  html: string
}

/**
 * Escapa texto que va a incrustarse en el HTML del email.
 *
 * Lo que escribe una persona (el motivo de una suspensión, un mensaje de contacto) no
 * puede entrar tal cual: un `<` suelto rompe el correo y una etiqueta llegaría viva.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function layout(opts: LayoutOptions): string {
  const base = appUrl()
  const paras = (opts.paragraphs ?? [])
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#1A2733;font-size:15px;line-height:1.6;">${p}</p>`,
    )
    .join('')
  const cta = opts.cta
    ? `<div style="margin:22px 0 6px;"><a href="${base}${opts.cta.path}" style="display:inline-block;background:#1B3A5F;color:#ffffff;text-decoration:none;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:12px 24px;border-radius:6px;font-family:Arial,sans-serif;font-size:14px;">${opts.cta.label}</a></div>`
    : ''

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#F4F6F9;padding:24px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:2px solid #E1E7EF;border-radius:6px;overflow:hidden;box-shadow:4px 4px 0 0 #E1E7EF;">
      <div style="background:#1B3A5F;padding:18px 24px;">
        <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:0.5px;">Model<span style="color:#F7941D;">Market</span></span>
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
}
