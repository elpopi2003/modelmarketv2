import { escapeHtml, layout, type EmailContent, type LayoutContext } from '../layout'

/**
 * Emails del ciclo de vida de una cuenta: suspensión, reactivación y borrado (propio o por
 * un administrador). Portados de supabase/functions/_shared/account-emails.ts. El email de
 * cambio de plan llegará con la fase de pagos.
 */

export function suspensionEmail(name: string, reason: string, ctx: LayoutContext): EmailContent {
  return layout(
    {
      subject: 'Tu cuenta de ModelMarket ha sido suspendida',
      heading: `Hemos suspendido tu cuenta, ${escapeHtml(name)}`,
      intro:
        'Mientras dure la suspensión no podrás acceder a ModelMarket, y tus anuncios y peticiones no se mostrarán al resto de usuarios.',
      paragraphs: [
        `<strong>Motivo:</strong> ${escapeHtml(reason)}`,
        'Tu contenido no se ha borrado: si levantamos la suspensión, lo recuperarás tal y como estaba.',
      ],
      footNote:
        'Si crees que se trata de un error, responde a este correo o escríbenos desde el formulario de contacto y lo revisamos.',
    },
    ctx,
  )
}

export function reinstatementEmail(name: string, ctx: LayoutContext): EmailContent {
  return layout(
    {
      subject: 'Tu cuenta de ModelMarket vuelve a estar activa',
      heading: `Ya puedes volver a entrar, ${escapeHtml(name)}`,
      intro:
        'Hemos levantado la suspensión de tu cuenta. Tus anuncios y peticiones vuelven a ser visibles.',
      cta: { label: 'Entrar en ModelMarket', href: '/auth' },
    },
    ctx,
  )
}

/**
 * Confirmación de baja pedida por la propia persona. Sin botón a propósito: la cuenta ya no
 * existe, así que cualquier enlace llevaría a una sesión que no puede iniciar.
 */
export function accountDeletedEmail(name: string, ctx: LayoutContext): EmailContent {
  return layout(
    {
      subject: 'Tu cuenta de ModelMarket ha sido eliminada',
      heading: `Tu cuenta ha sido eliminada, ${escapeHtml(name)}`,
      intro: 'Hemos completado la baja que pediste. Sentimos verte marchar.',
      paragraphs: [
        'Se han borrado tu perfil, tus anuncios, tus peticiones, tus fotos, tus ofertas y tus conversaciones.',
        'Puedes volver a registrarte cuando quieras, aunque el contenido anterior no se puede recuperar.',
      ],
      footNote:
        'Si no has sido tú quien ha pedido la baja, respóndenos a este correo cuanto antes.',
    },
    ctx,
  )
}

/**
 * Baja ejecutada por un administrador. Distinta de la anterior porque la persona NO la ha
 * pedido: lo importante es la vía para reclamar.
 */
export function accountDeletedByAdminEmail(name: string, ctx: LayoutContext): EmailContent {
  return layout(
    {
      subject: 'Tu cuenta de ModelMarket ha sido eliminada',
      heading: `Hemos eliminado tu cuenta, ${escapeHtml(name)}`,
      intro:
        'Un administrador ha dado de baja tu cuenta en ModelMarket por incumplir las normas de la plataforma.',
      paragraphs: [
        'Se han borrado tu perfil, tus anuncios, tus peticiones, tus fotos, tus ofertas y tus conversaciones.',
      ],
      footNote:
        'Si crees que se trata de un error, responde a este correo y revisaremos la decisión.',
    },
    ctx,
  )
}

/** Mensaje del formulario de contacto, para el buzón de ModelMarket. */
export function contactEmail(
  p: { name: string; email: string; subject: string; message: string },
  ctx: LayoutContext,
): EmailContent {
  return layout(
    {
      subject: `Contacto: ${p.subject}`,
      heading: 'Nuevo mensaje del formulario de contacto',
      paragraphs: [
        `<strong>De:</strong> ${escapeHtml(p.name)} (${escapeHtml(p.email)})`,
        `<strong>Asunto:</strong> ${escapeHtml(p.subject)}`,
        escapeHtml(p.message).replace(/\n/g, '<br>'),
      ],
      footNote: 'Responde a este email para contestar directamente al remitente.',
    },
    ctx,
  )
}
