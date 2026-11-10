import type { ContactFormValues } from '@/lib/schemas/contact'
import { api } from './http'

/**
 * Formulario de contacto. El servidor verifica el token de reCAPTCHA v3 y deja el mensaje
 * en la cola de correo hacia el buzón de ModelMarket.
 */
export async function sendContactMessage(
  values: ContactFormValues,
  recaptchaToken: string | null,
): Promise<void> {
  await api('/contact', { body: { ...values, recaptchaToken } })
}
