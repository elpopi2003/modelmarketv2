// Emails del ciclo de vida de una cuenta: suspensión, reactivación, cambio de plan y
// borrado (propio o por un administrador).
//
// Separados de `email-templates.ts` para que las funciones de cuenta desplieguen solo lo
// que usan, en vez de arrastrar todas las plantillas del proyecto.

import { escapeHtml, layout, type EmailContent } from './email-layout.ts'

export function suspensionEmail(name: string, reason: string): EmailContent {
  return {
    subject: 'Tu cuenta de ModelMarket ha sido suspendida',
    html: layout({
      heading: `Hemos suspendido tu cuenta, ${escapeHtml(name)}`,
      intro:
        'Mientras dure la suspensión no podrás acceder a ModelMarket, y tus anuncios y peticiones no se mostrarán al resto de usuarios.',
      paragraphs: [
        `<strong>Motivo:</strong> ${escapeHtml(reason)}`,
        'Tu contenido no se ha borrado: si levantamos la suspensión, lo recuperarás tal y como estaba.',
      ],
      footNote:
        'Si crees que se trata de un error, responde a este correo o escríbenos desde el formulario de contacto y lo revisamos.',
    }),
  }
}

export function reinstatementEmail(name: string): EmailContent {
  return {
    subject: 'Tu cuenta de ModelMarket vuelve a estar activa',
    html: layout({
      heading: `Ya puedes volver a entrar, ${escapeHtml(name)}`,
      intro:
        'Hemos levantado la suspensión de tu cuenta. Tus anuncios y peticiones vuelven a ser visibles.',
      cta: { label: 'Entrar en ModelMarket', path: '/auth' },
    }),
  }
}

/**
 * Confirmación de baja pedida por la propia persona.
 *
 * Sin CTA a propósito: la cuenta ya no existe, así que cualquier botón llevaría a una
 * pantalla de sesión que no puede iniciar. Se le dice qué se ha borrado y qué no.
 */
export function accountDeletedEmail(name: string): EmailContent {
  return {
    subject: 'Tu cuenta de ModelMarket ha sido eliminada',
    html: layout({
      heading: `Tu cuenta ha sido eliminada, ${escapeHtml(name)}`,
      intro: 'Hemos completado la baja que pediste. Sentimos verte marchar.',
      paragraphs: [
        'Se han borrado tu perfil, tus anuncios, tus peticiones, tus ofertas y tus conversaciones. Si tenías una suscripción activa, la hemos cancelado: no se te volverá a cobrar.',
        'Puedes volver a registrarte cuando quieras, aunque el contenido anterior no se puede recuperar.',
      ],
      footNote: 'Si no has sido tú quien ha pedido la baja, respóndenos a este correo cuanto antes.',
    }),
  }
}

/**
 * Baja ejecutada por un administrador. Se distingue de la anterior porque la persona NO
 * lo ha pedido: enviarle el texto de "la baja que pediste" sería desconcertante, y la vía
 * para reclamar es lo más importante del mensaje.
 */
export function accountDeletedByAdminEmail(name: string): EmailContent {
  return {
    subject: 'Tu cuenta de ModelMarket ha sido eliminada',
    html: layout({
      heading: `Hemos eliminado tu cuenta, ${escapeHtml(name)}`,
      intro:
        'Un administrador ha dado de baja tu cuenta en ModelMarket por incumplir las normas de la plataforma.',
      paragraphs: [
        'Se han borrado tu perfil, tus anuncios, tus peticiones, tus ofertas y tus conversaciones. Si tenías una suscripción activa, la hemos cancelado: no se te volverá a cobrar.',
      ],
      footNote:
        'Si crees que se trata de un error, responde a este correo y revisaremos la decisión.',
    }),
  }
}

const TIER_LABEL: Record<string, string> = { free: 'Free', pro: 'PRO', retail: 'Retail' }

export function tierChangedByAdminEmail(name: string, tier: string): EmailContent {
  const label = TIER_LABEL[tier] ?? tier
  return {
    subject: `Tu plan de ModelMarket ha cambiado a ${label}`,
    html: layout({
      heading: `Tu plan ahora es ${label}, ${escapeHtml(name)}`,
      intro: `Hemos cambiado tu plan a ${label} desde la administración.`,
      paragraphs: [
        tier === 'free'
          ? 'Si tenías una suscripción de pago, la hemos cancelado: no se te volverá a cobrar.'
          : 'El cambio ya está aplicado en tu cuenta.',
      ],
      cta: { label: 'Ver planes', path: '/precios' },
      footNote: 'Si no esperabas este cambio, escríbenos y lo revisamos.',
    }),
  }
}
