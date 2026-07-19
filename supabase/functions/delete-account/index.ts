// delete-account — elimina la cuenta del usuario autenticado.
//
// Cancela ANTES la suscripción de Stripe: sin eso, la persona se da de baja pero sigue
// pagando (detectado en pruebas: una suscripción activa cuyo user_id ya no existía).
// Si la cancelación falla, se ABORTA el borrado: es preferible una baja que hay que
// reintentar a una cuenta borrada que sigue facturando.
//
// El borrado de auth.users cascada sobre profiles, listings, requests, offers,
// conversations, messages, favorites, notifications y subscriptions (FK on delete
// cascade). Los ficheros de storage quedan huérfanos; limpieza pendiente para M6.
// Autenticada. Respuesta homogénea { ok, data, error }.

import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { corsHeaders } from '../_shared/cors.ts'
import { fail, ok } from '../_shared/response.ts'

/** Cancela la suscripción del usuario si la tiene. Devuelve el id cancelado o null. */
// deno-lint-ignore no-explicit-any
async function cancelSubscription(admin: any, userId: string): Promise<string | null> {
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
    // Ya cancelada o inexistente: el objetivo (dejar de cobrar) se cumple igual.
    if ((e as { code?: string })?.code === 'resource_missing') return subscriptionId
    throw e
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return fail('No autorizado', 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail('No autorizado', 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let cancelled: string | null = null
    try {
      cancelled = await cancelSubscription(admin, user.id)
    } catch (e) {
      return fail(
        `No se pudo cancelar tu suscripción, así que no hemos borrado la cuenta. Inténtalo de nuevo o cancela desde "Gestionar suscripción". (${e})`,
        502,
      )
    }

    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) return fail(error.message, 500)

    return ok({ deleted: true, cancelledSubscription: cancelled })
  } catch (e) {
    return fail(String(e), 500)
  }
})
