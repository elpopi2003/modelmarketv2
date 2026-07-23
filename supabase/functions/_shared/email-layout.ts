// Maquetado común de los emails "Blueprint / Industrial" de ModelMarket.
//
// Vive aparte de `email-templates.ts` para que una función que solo necesita una plantilla
// no tenga que arrastrar todas las demás al desplegarse.

function appUrl(): string {
  return Deno.env.get('APP_URL') ?? 'https://modelmarket.es'
}

/**
 * Logotipo servido desde el bucket público `brand`.
 *
 * URL absoluta y fija a propósito: un cliente de correo abre la imagen desde fuera, sin
 * sesión y sin saber nada de la aplicación. No puede depender de APP_URL, que apunta al
 * sitio desplegado y dejaría el logo roto en cuanto el dominio no responda.
 */
const LOGO_URL =
  'https://shanozqxmmdiqvqhffbz.supabase.co/storage/v1/object/public/brand/logo.png'

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

// Cabecera con banda BLANCA (no el azul de marca): el logotipo es azul marino sobre
// transparente y sobre azul resultaba ilegible. La franja naranja inferior conserva el
// acento de la cabecera anterior. El `alt` está cuidado porque muchos clientes de correo
// bloquean las imágenes por defecto: si el logo no carga, se lee el nombre, no un hueco.
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
      <div style="background:#ffffff;padding:20px 24px 16px;border-bottom:3px solid #F7941D;">
        <img src="${LOGO_URL}" alt="ModelMarket" width="220"
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
}
