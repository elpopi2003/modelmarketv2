// create-checkout — inicia un Checkout de Stripe (suscripción PRO/Retail).
// Autenticada (JWT del usuario). Devuelve { url } de la sesión de checkout.
// Secretos: STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_RETAIL, APP_URL.

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

    const { tier } = await req.json().catch(() => ({}))
    const priceId =
      tier === 'pro'
        ? Deno.env.get('STRIPE_PRICE_PRO')
        : tier === 'retail'
          ? Deno.env.get('STRIPE_PRICE_RETAIL')
          : null
    if (!priceId) return fail('Tier inválido (usa "pro" o "retail")')

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })
    const appUrl = Deno.env.get('APP_URL') ?? 'https://modelmarket.es'

    // Reutiliza el cliente de Stripe por email, o lo crea.
    const existing = await stripe.customers.list({ email: user.email, limit: 1 })
    const customerId =
      existing.data[0]?.id ??
      (await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } })).id

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/precios?checkout=cancel`,
      subscription_data: { metadata: { user_id: user.id, tier } },
      metadata: { user_id: user.id, tier },
    })

    return ok({ url: session.url })
  } catch (e) {
    return fail(String(e), 500)
  }
})
