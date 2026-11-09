import { escapeHtml, layout, type EmailContent, type LayoutContext } from '../layout'

/** Confirmación de alta: sin verificar el email no se puede iniciar sesión. */
export function verifyEmailEmail(name: string, link: string, ctx: LayoutContext): EmailContent {
  return layout(
    {
      subject: 'Confirma tu email en ModelMarket',
      heading: `Bienvenido a ModelMarket, ${escapeHtml(name)}`,
      intro: 'Solo falta un paso: confirma que este email es tuyo para activar tu cuenta.',
      cta: { label: 'Confirmar mi email', href: link },
      footNote:
        'El enlace caduca en 24 horas. Si no te has registrado en ModelMarket, ignora este correo: sin confirmar, la cuenta no se activa.',
    },
    ctx,
  )
}

export function resetPasswordEmail(name: string, link: string, ctx: LayoutContext): EmailContent {
  return layout(
    {
      subject: 'Restablece tu contraseña de ModelMarket',
      heading: `Hola, ${escapeHtml(name)}`,
      intro: 'Hemos recibido una petición para restablecer la contraseña de tu cuenta.',
      cta: { label: 'Elegir nueva contraseña', href: link },
      footNote:
        'El enlace caduca en 1 hora y solo sirve una vez. Si no lo has pedido tú, ignora este correo: tu contraseña no cambiará.',
    },
    ctx,
  )
}

/**
 * Se envía cuando alguien intenta registrarse con un email que ya tiene cuenta. La API
 * responde lo mismo que en un alta normal (para no revelar qué emails están registrados)
 * y el aviso llega solo al dueño real del email.
 */
export function alreadyRegisteredEmail(name: string, ctx: LayoutContext): EmailContent {
  return layout(
    {
      subject: 'Ya tienes una cuenta en ModelMarket',
      heading: `Hola, ${escapeHtml(name)}`,
      intro:
        'Alguien (probablemente tú) ha intentado crear una cuenta nueva con este email, pero ya tienes una.',
      paragraphs: [
        'Puedes entrar con tu contraseña o, si no la recuerdas, restablecerla desde la pantalla de acceso.',
      ],
      cta: { label: 'Entrar en ModelMarket', href: '/auth' },
      footNote: 'Si no has sido tú, no tienes que hacer nada: tu cuenta sigue igual.',
    },
    ctx,
  )
}

export function passwordChangedEmail(name: string, ctx: LayoutContext): EmailContent {
  return layout(
    {
      subject: 'Tu contraseña de ModelMarket ha cambiado',
      heading: `Hola, ${escapeHtml(name)}`,
      intro:
        'La contraseña de tu cuenta se acaba de cambiar y hemos cerrado el resto de sesiones abiertas.',
      footNote:
        'Si no has sido tú, restablece la contraseña cuanto antes y respóndenos a este correo.',
    },
    ctx,
  )
}
