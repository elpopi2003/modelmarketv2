// admin-set-tier — cambia el plan de otro usuario desde administración. Solo admins.
//
// El webhook de Stripe es la fuente de verdad de la suscripción, así que esta función NO
// se limita a escribir el tier en la base: eso duraría hasta el siguiente evento, que lo
// revertiría, y encima seguiríamos cobrando. Se actúa sobre Stripe y la base se actualiza
// en el mismo sentido, de forma que el webhook llegue a confirmar lo mismo:
//
//   → free           cancela la suscripción (deja de pagar)
//   pro ↔ retail     cambia el precio de la suscripción, con prorrateo
//   sin suscripción  solo se escribe el tier (nada que cancelar)
//
// Secretos: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY,
// STRIPE_PRICE_PRO, STRIPE_PRICE_RETAIL, RESEND_API_KEY, EMAIL_FROM, APP_URL.

import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { corsHeaders } from '../_shared/cors.ts'
import { fail, ok } from '../_shared/response.ts'
import { sendEmail } from '../_shared/resend.ts'
import { tierChangedByAdminEmail } from '../_shared/moderation-emails.ts'

type Tier = 'free' | 'pro' | 'retail'
const TIERS: Tier[] = ['free', 'pro', 'retail']

function priceFor(tier: Exclude<Tier, 'free'>): string | undefined {
  return tier === 'pro' ? Deno.env.get('STRIPE_PRICE_PRO') : Deno.env.get('STRIPE_PRICE_RETAIL')
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

    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    })
    if (roleError) return fail(roleError.message, 500)
    if (!isAdmin) return fail('Solo administradores', 403)

    const body = await req.json().catch(() => null)
    const targetId = body?.userId as string | undefined
    const tier = body?.tier as Tier | undefined
    if (!targetId) return fail('Falta userId', 400)
    if (!tier || !TIERS.includes(tier)) return fail('tier debe ser free, pro o retail', 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: sub } = await admin
      .from('subscriptions')
      .select('tier, status, stripe_customer_id, stripe_subscription_id')
      .eq('user_id', targetId)
      .maybeSingle()

    const currentTier = (sub?.tier ?? 'free') as Tier
    if (currentTier === tier) return fail(`Ese usuario ya está en ${tier}`, 400)

    const subscriptionId = sub?.stripe_subscription_id ?? null
    let stripeAction: 'cancelled' | 'price_changed' | 'none' = 'none'

    if (subscriptionId) {
      const secret = Deno.env.get('STRIPE_SECRET_KEY')
      if (!secret) return fail('Falta STRIPE_SECRET_KEY: no se puede tocar la suscripción', 500)
      const stripe = new Stripe(secret, {
        apiVersion: '2024-06-20',
        httpClient: Stripe.createFetchHttpClient(),
      })

      try {
        if (tier === 'free') {
          await stripe.subscriptions.cancel(subscriptionId)
          stripeAction = 'cancelled'
        } else {
          const price = priceFor(tier)
          if (!price) return fail(`Falta el precio de Stripe para ${tier}`, 500)
          const current = await stripe.subscriptions.retrieve(subscriptionId)
          const itemId = current.items.data[0]?.id
          if (!itemId) return fail('La suscripción de Stripe no tiene líneas', 502)
          await stripe.subscriptions.update(subscriptionId, {
            items: [{ id: itemId, price }],
            proration_behavior: 'create_prorations',
          })
          stripeAction = 'price_changed'
        }
      } catch (e) {
        // Que ya no exista en Stripe no es un error si íbamos a cancelar: el objetivo
        // (no cobrar) ya está cumplido.
        const code = (e as { code?: string })?.code
        if (!(code === 'resource_missing' && tier === 'free')) {
          return fail(`No se pudo actualizar la suscripción en Stripe, no se ha cambiado el plan: ${e}`, 502)
        }
        stripeAction = 'cancelled'
      }
    }

    // La base se actualiza en el mismo sentido que Stripe para que el cambio sea inmediato
    // en la aplicación; el webhook llegará después y confirmará lo mismo.
    const { error: upsertError } = await admin.from('subscriptions').upsert(
      {
        user_id: targetId,
        tier,
        status: tier === 'free' ? 'canceled' : 'active',
        stripe_customer_id: sub?.stripe_customer_id ?? null,
        stripe_subscription_id: tier === 'free' ? null : subscriptionId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (upsertError) return fail(upsertError.message, 500)

    const { data: targetUser } = await admin.auth.admin.getUserById(targetId)
    const { data: profile } = await admin
      .from('profiles')
      .select('display_name, username')
      .eq('id', targetId)
      .maybeSingle()
    const name = profile?.display_name || profile?.username || 'coleccionista'

    let emailSent = false
    let emailError: string | null = null
    const email = targetUser?.user?.email
    if (email) {
      try {
        const { subject, html } = tierChangedByAdminEmail(name, tier)
        await sendEmail({ to: email, subject, html })
        emailSent = true
      } catch (e) {
        emailError = String(e)
      }
    }

    return ok({ userId: targetId, from: currentTier, to: tier, stripeAction, emailSent, emailError })
  } catch (e) {
    return fail(String(e), 500)
  }
})
