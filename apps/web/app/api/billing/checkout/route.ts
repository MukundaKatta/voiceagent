import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';
import { PLAN_PRICES } from '@voiceagent/shared';
import type { Plan } from '@voiceagent/shared';

const PRICE_LOOKUP_KEYS: Record<Plan, string> = {
  starter: 'voiceagent_starter',
  growth: 'voiceagent_growth',
  pro: 'voiceagent_pro',
  agency: 'voiceagent_agency',
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { plan } = await request.json() as { plan: Plan };
  if (!PLAN_PRICES[plan]) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id, stripe_customer_id, name')
    .single();

  if (!org) return NextResponse.json({ error: 'No organization' }, { status: 400 });

  // Create or retrieve Stripe customer
  let customerId = org.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: org.name,
      metadata: { org_id: org.id },
    });
    customerId = customer.id;
    await supabase
      .from('organizations')
      .update({ stripe_customer_id: customerId })
      .eq('id', org.id);
  }

  const origin = new URL(request.url).origin;

  // Create checkout session with the plan price + metered overage price
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `VoiceAgent ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
            description: `AI Voice Receptionist - ${plan} plan`,
          },
          unit_amount: PLAN_PRICES[plan],
          recurring: { interval: 'month' },
        },
        quantity: 1,
      },
    ],
    subscription_data: {
      metadata: { org_id: org.id, plan },
    },
    success_url: `${origin}/billing?success=true`,
    cancel_url: `${origin}/billing?cancelled=true`,
  });

  return NextResponse.json({ url: session.url });
}
