// Plantillas de email "Blueprint / Industrial" de ModelMarket.
// HTML con CSS inline (compatible con clientes de correo). Cada builder devuelve
// { subject, html }. Los enlaces se resuelven contra APP_URL.

function appUrl(): string {
  return Deno.env.get('APP_URL') ?? 'https://modelmarket.es'
}

interface LayoutOptions {
  heading: string
  intro?: string
  paragraphs?: string[]
  cta?: { label: string; path: string }
  footNote?: string
}

function layout(opts: LayoutOptions): string {
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

export interface EmailContent {
  subject: string
  html: string
}

// ---- Cuenta / suscripción -------------------------------------------------

export function welcomeEmail(name: string): EmailContent {
  return {
    subject: '¡Bienvenido a ModelMarket!',
    html: layout({
      heading: `Bienvenido, ${name}`,
      intro:
        'Tu cuenta está lista. Publica anuncios, crea peticiones y contacta con otros coleccionistas — siempre con 0% de comisión.',
      cta: { label: 'Explorar el catálogo', path: '/explorar' },
    }),
  }
}

export function proWelcomeEmail(name: string): EmailContent {
  return {
    subject: 'Ya eres PRO en ModelMarket',
    html: layout({
      heading: `Gracias por hacerte PRO, ${name}`,
      intro: 'Has desbloqueado anuncios ilimitados, más fotos, visibilidad inmediata e insignia PRO.',
      cta: { label: 'Publicar un anuncio', path: '/publicar' },
    }),
  }
}

export function downgradeEmail(name: string): EmailContent {
  return {
    subject: 'Tu plan ha cambiado a Free',
    html: layout({
      heading: `Tu suscripción ha vuelto a Free, ${name}`,
      intro:
        'Seguirás teniendo acceso a ModelMarket con los límites del plan Free. Puedes volver a PRO cuando quieras.',
      cta: { label: 'Ver planes', path: '/precios' },
    }),
  }
}

// ---- Mensajería y ofertas -------------------------------------------------

export function newMessageEmail(p: {
  recipientName: string
  senderName: string
  listingTitle: string
  conversationId: string
}): EmailContent {
  return {
    subject: `Nuevo mensaje de ${p.senderName}`,
    html: layout({
      heading: 'Tienes un nuevo mensaje',
      paragraphs: [
        `<strong>${p.senderName}</strong> te ha escrito sobre <strong>${p.listingTitle}</strong>.`,
      ],
      cta: { label: 'Leer el mensaje', path: `/mensajes/${p.conversationId}` },
    }),
  }
}

export function newOfferEmail(p: {
  recipientName: string
  listingTitle: string
  amount: string
  listingId: string
}): EmailContent {
  return {
    subject: `Oferta por "${p.listingTitle}"`,
    html: layout({
      heading: 'Has recibido una oferta',
      paragraphs: [
        `Alguien ofrece <strong>${p.amount}</strong> por tu anuncio <strong>${p.listingTitle}</strong>.`,
      ],
      cta: { label: 'Ver el anuncio', path: `/producto/${p.listingId}` },
    }),
  }
}

export function newRequestOfferEmail(p: {
  recipientName: string
  requestTitle: string
}): EmailContent {
  return {
    subject: `Alguien tiene lo que buscas`,
    html: layout({
      heading: 'Respuesta a tu petición',
      paragraphs: [
        `Un vendedor puede tener lo que pedías en <strong>${p.requestTitle}</strong>.`,
      ],
      cta: { label: 'Ver peticiones', path: '/mis-peticiones' },
    }),
  }
}

// ---- Estados de contenido -------------------------------------------------

export function listingStatusEmail(p: {
  listingTitle: string
  approved: boolean
  listingId: string
}): EmailContent {
  return {
    subject: p.approved ? `Tu anuncio está publicado` : `Tu anuncio necesita cambios`,
    html: layout({
      heading: p.approved ? 'Anuncio aprobado' : 'Anuncio no aprobado',
      paragraphs: [
        p.approved
          ? `Tu anuncio <strong>${p.listingTitle}</strong> ya es visible en el catálogo.`
          : `Tu anuncio <strong>${p.listingTitle}</strong> no cumple las normas y no se ha publicado. Revísalo y vuelve a intentarlo.`,
      ],
      cta: { label: 'Ver el anuncio', path: `/producto/${p.listingId}` },
    }),
  }
}

export function requestStatusEmail(p: {
  requestTitle: string
  status: string
}): EmailContent {
  return {
    subject: `Tu petición: ${p.status}`,
    html: layout({
      heading: 'Estado de tu petición',
      paragraphs: [
        `Tu petición <strong>${p.requestTitle}</strong> ha cambiado a <strong>${p.status}</strong>.`,
      ],
      cta: { label: 'Ver tus peticiones', path: '/mis-peticiones' },
    }),
  }
}

// ---- Despachador de notificaciones ----------------------------------------

/**
 * Email construido a partir de una notificación de la BD. Los triggers ya redactan
 * un título y cuerpo cuidados por cada evento, así que un único builder cubre todos
 * los tipos (mensaje, oferta, favorito, reporte…) y los que se añadan después.
 */
export function notificationEmail(p: {
  title: string
  body?: string | null
  link?: string | null
}): EmailContent {
  return {
    subject: p.title,
    html: layout({
      heading: p.title,
      paragraphs: p.body ? [p.body] : [],
      cta: p.link ? { label: 'Abrir en ModelMarket', path: p.link } : undefined,
      footNote:
        'Puedes desactivar estos avisos por email en Configuración → Notificaciones.',
    }),
  }
}

// ---- Contacto / admin -----------------------------------------------------

export function contactEmail(p: { name: string; email: string; message: string }): EmailContent {
  return {
    subject: `Contacto de ${p.name}`,
    html: layout({
      heading: 'Nuevo mensaje del formulario de contacto',
      paragraphs: [
        `<strong>De:</strong> ${p.name} (${p.email})`,
        `<strong>Mensaje:</strong><br>${p.message}`,
      ],
      footNote: 'Responde directamente a este email para contestar al remitente.',
    }),
  }
}

/** Un ejemplo de cada tipo de email, para pruebas de envío. */
export function allSampleEmails(): { type: string; subject: string; html: string }[] {
  const samples: { type: string; content: EmailContent }[] = [
    { type: 'welcome', content: welcomeEmail('Alfredo') },
    { type: 'pro-welcome', content: proWelcomeEmail('Alfredo') },
    { type: 'downgrade', content: downgradeEmail('Alfredo') },
    {
      type: 'new-message',
      content: newMessageEmail({
        recipientName: 'Alfredo',
        senderName: 'Comprador de prueba',
        listingTitle: 'Panzer IV Ausf. H 1:35',
        conversationId: '00000000-0000-0000-0000-000000000000',
      }),
    },
    {
      type: 'new-offer',
      content: newOfferEmail({
        recipientName: 'Alfredo',
        listingTitle: 'Panzer IV Ausf. H 1:35',
        amount: '45,00 €',
        listingId: '00000000-0000-0000-0000-000000000000',
      }),
    },
    {
      type: 'new-request-offer',
      content: newRequestOfferEmail({
        recipientName: 'Alfredo',
        requestTitle: 'Busco Airfix Spitfire 1:48 descatalogado',
      }),
    },
    {
      type: 'listing-status',
      content: listingStatusEmail({
        listingTitle: 'Panzer IV Ausf. H 1:35',
        approved: true,
        listingId: '00000000-0000-0000-0000-000000000000',
      }),
    },
    {
      type: 'request-status',
      content: requestStatusEmail({
        requestTitle: 'Busco Airfix Spitfire 1:48',
        status: 'Encontrada',
      }),
    },
    {
      type: 'contact',
      content: contactEmail({
        name: 'Visitante',
        email: 'visitante@example.com',
        message: 'Hola, tengo una duda sobre los planes PRO.',
      }),
    },
  ]

  return samples.map((s) => ({ type: s.type, subject: s.content.subject, html: s.content.html }))
}
