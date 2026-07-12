// check-subscription — reconcilia el tier del usuario consultando Stripe y
// sincronizando la tabla `subscriptions` (service_role). Fallback del webhook.
// Autenticada. Devuelve { tier, status }.
// Secretos: STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_RETAIL.

import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonH = { ...cors, 'Content-Type': 'application/json' }
const ok = (data: unknown) => new Response(JSON.stringify({ ok: true, data, error: null }), { headers: jsonH })
const fail = (error: string, status = 400) =>
  new Response(JSON.stringify({ ok: false, data: null, error }), { status, headers: jsonH })

function tierFromPrice(priceId: string | undefined): 'pro' | 'retail' | 'free' {
  if (priceId && priceId === Deno.env.get('STRIPE_PRICE_PRO')) return 'pro'
  if (priceId && priceId === Deno.env.get('STRIPE_PRICE_RETAIL')) return 'retail'
  return 'free'
}

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

    const customers = await stripe.customers.list({ email: user.email, limit: 1 })
    const customerId = customers.data[0]?.id

    let tier: 'pro' | 'retail' | 'free' = 'free'
    let status = 'inactive'
    let subscriptionId: string | null = null
    let periodEnd: string | null = null

    if (customerId) {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 })
      const sub = subs.data[0]
      if (sub) {
        tier = tierFromPrice(sub.items.data[0]?.price?.id)
        status = sub.status
        subscriptionId = sub.id
        periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null
      }
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    await admin.from('subscriptions').upsert(
      {
        user_id: user.id,
        tier,
        status,
        stripe_customer_id: customerId ?? null,
        stripe_subscription_id: subscriptionId,
        current_period_end: periodEnd,
      },
      { onConflict: 'user_id' },
    )

    return ok({ tier, status })
  } catch (e) {
    return fail(String(e), 500)
  }
})
