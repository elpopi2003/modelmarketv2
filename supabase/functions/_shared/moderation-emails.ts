// Emails de moderación de cuentas: suspensión, reactivación y cambio de plan por un admin.
//
// Separados de `email-templates.ts` para que las funciones de administración desplieguen
// solo lo que usan.

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
