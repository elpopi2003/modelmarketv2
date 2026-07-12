// customer-portal — abre el portal de facturación de Stripe del usuario.
// Autenticada. Devuelve { url }. Secretos: STRIPE_SECRET_KEY, APP_URL.

import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = { ...cors, 'Content-Type': 'application/json' }
const ok = (data: unknown) => new Response(JSON.stringify({ ok: true, data, error: null }), { headers: json })
const fail = (error: string, status = 400) =>
  new Response(JSON.stringify({ ok: false, data: null, error }), { status, headers: json })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return fail('No autorizado', 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return fail('No autorizado', 401)

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })
    const appUrl = Deno.env.get('APP_URL') ?? 'https://modelmarket.es'

    const customers = await stripe.customers.list({ email: user.email, limit: 1 })
    const customerId = customers.data[0]?.id
    if (!customerId) return fail('No tienes una suscripción activa', 404)

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/dashboard`,
    })
    return ok({ url: session.url })
  } catch (e) {
    return fail(String(e), 500)
  }
})
