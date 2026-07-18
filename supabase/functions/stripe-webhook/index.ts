// stripe-webhook — FUENTE DE VERDAD de la suscripción. Verifica la firma y sincroniza
// la tabla `subscriptions` con service_role (salta RLS). Despliega con --no-verify-jwt.
// Secretos: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO, STRIPE_PRICE_RETAIL.

import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})
const cryptoProvider = Stripe.createSubtleCryptoProvider()

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function tierFromPrice(priceId: string | undefined): 'pro' | 'retail' | 'free' {
  if (priceId && priceId === Deno.env.get('STRIPE_PRICE_PRO')) return 'pro'
  if (priceId && priceId === Deno.env.get('STRIPE_PRICE_RETAIL')) return 'retail'
  return 'free'
}

const TIER_LABEL: Record<string, string> = { pro: 'PRO', retail: 'Retail', free: 'Free' }

/**
 * Avisa del cambio de plan emitiendo una NOTIFICACIÓN, no un email directo: así pasa por
 * el despachador (send-notification-email), respeta la preferencia notify_email del
 * usuario y además le aparece en la campanita. Un solo camino para todos los avisos.
 *
 * Solo se emite cuando el tier REALMENTE cambia: Stripe manda varios eventos por una
 * misma alta (checkout.session.completed y customer.subscription.updated), y comparando
 * con el tier previo evitamos duplicar el aviso.
 *
 * Nunca rompe la sincronización: si esto falla, el plan ya se ha guardado igualmente.
 */
async function notifyTierChange(userId: string, previous: string | null, next: string) {
  if (previous === next) return

  const upgraded = next === 'pro' || next === 'retail'
  const downgraded = (previous === 'pro' || previous === 'retail') && next === 'free'
  if (!upgraded && !downgraded) return

  const notification = upgraded
    ? {
        title: `Ya eres ${TIER_LABEL[next]} en ModelMarket`,
        body: 'Has desbloqueado anuncios ilimitados, más fotos, visibilidad inmediata e insignia en tu perfil.',
        link: '/publicar',
      }
    : {
        title: 'Tu plan ha vuelto a Free',
        body: 'Seguirás teniendo acceso a ModelMarket con los límites del plan Free. Puedes volver a PRO cuando quieras.',
        link: '/precios',
      }

  try {
    await admin.from('notifications').insert({
      user_id: userId,
      type: 'subscription',
      ...notification,
    })
  } catch (e) {
    console.error('[stripe-webhook] aviso de cambio de plan', e)
  }
}

// deno-lint-ignore no-explicit-any
async function syncSubscription(subscription: any) {
  const userId = subscription.metadata?.user_id
  if (!userId) return
  const priceId = subscription.items?.data?.[0]?.price?.id
  const active = subscription.status === 'active' || subscription.status === 'trialing'
  const tier = active ? tierFromPrice(priceId) : 'free'

  // Tier previo, para saber si el plan cambia (y no duplicar avisos).
  const { data: current } = await admin
    .from('subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .maybeSingle()
  const previousTier = current?.tier ?? null

  await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      tier,
      status: subscription.status,
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    },
    { onConflict: 'user_id' },
  )

  await notifyTierChange(userId, previousTier, tier)
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()
  if (!signature) return new Response('Falta firma', { status: 400 })

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
      undefined,
      cryptoProvider,
    )
  } catch (e) {
    return new Response(`Firma inválida: ${e}`, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          // El metadata está en la suscripción; asegura user_id desde la sesión si falta.
          if (!sub.metadata?.user_id && session.metadata?.user_id) {
            sub.metadata = { ...sub.metadata, user_id: session.metadata.user_id }
          }
          await syncSubscription(sub)
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object)
        break
      }
      default:
        break
    }
  } catch (e) {
    return new Response(`Error procesando: ${e}`, { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
