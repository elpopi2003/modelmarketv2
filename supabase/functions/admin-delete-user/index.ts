// admin-delete-user — elimina la cuenta de OTRO usuario. Solo administradores.
//
// Comprueba el rol en la BD (has_role) con el JWT de quien llama, no se fía del cliente.
// Cancela ANTES la suscripción de Stripe, por el mismo motivo que delete-account: borrar
// al usuario sin cancelar lo deja pagando indefinidamente. Si la cancelación falla se
// ABORTA el borrado.
//
// El borrado de auth.users cascada sobre su contenido.
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

    // El rol se comprueba en la BD, con la sesión de quien llama.
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    })
    if (roleError) return fail(roleError.message, 500)
    if (!isAdmin) return fail('Solo administradores', 403)

    const body = await req.json().catch(() => null)
    const targetId = body?.userId as string | undefined
    if (!targetId) return fail('Falta userId', 400)
    if (targetId === user.id) {
      return fail('Usa Configuración para eliminar tu propia cuenta', 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let cancelled: string | null = null
    try {
      cancelled = await cancelSubscription(admin, targetId)
    } catch (e) {
      return fail(
        `No se pudo cancelar la suscripción del usuario, así que no se ha borrado la cuenta: seguiría facturando. (${e})`,
        502,
      )
    }

    const { error } = await admin.auth.admin.deleteUser(targetId)
    if (error) return fail(error.message, 500)

    return ok({ deleted: targetId, cancelledSubscription: cancelled })
  } catch (e) {
    return fail(String(e), 500)
  }
})
