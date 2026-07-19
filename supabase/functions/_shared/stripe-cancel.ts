// Cancelación de la suscripción de Stripe al eliminar una cuenta.
//
// Sin esto, borrar el usuario lo elimina de la base de datos pero deja la suscripción
// viva en Stripe: la persona se da de baja y SIGUE PAGANDO. Detectado en pruebas con una
// suscripción activa cuyo user_id ya no existía.
//
// Nota: este helper existe para documentar la lógica; las funciones desplegadas de este
// proyecto son autocontenidas y llevan su propia copia.

import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'

/**
 * Cancela la suscripción del usuario, si tiene. Devuelve el id cancelado o null.
 *
 * Lanza si la cancelación falla por un motivo real: quien llama debe ABORTAR el borrado
 * en ese caso. Es preferible una baja que hay que reintentar a una cuenta borrada que
 * sigue facturando.
 *
 * Que la suscripción ya no exista en Stripe no es un error: el objetivo (no cobrar) ya
 * se cumple.
 */
export async function cancelUserSubscription(
  // deno-lint-ignore no-explicit-any
  admin: any,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('user_id', userId)
    .maybeSingle()

  const subscriptionId = data?.stripe_subscription_id
  if (!subscriptionId) return null

  const secret = Deno.env.get('STRIPE_SECRET_KEY')
  if (!secret) throw new Error('Falta STRIPE_SECRET_KEY: no se puede cancelar la suscripción')

  const stripe = new Stripe(secret, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  })

  try {
    await stripe.subscriptions.cancel(subscriptionId)
    return subscriptionId
  } catch (e) {
    // Ya cancelada o inexistente: el objetivo se cumple igualmente.
    const code = (e as { code?: string })?.code
    if (code === 'resource_missing') return subscriptionId
    throw e
  }
}
