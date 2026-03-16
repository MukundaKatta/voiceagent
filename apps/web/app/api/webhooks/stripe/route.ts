import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe/client';
import { createClient } from '@supabase/supabase-js';
import { PLAN_LIMITS } from '@voiceagent/shared';
import type { Plan } from '@voiceagent/shared';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature')!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    // Checkout completed — activate subscription
    case 'checkout.session.completed': {
      const session = event.data.object;
      const orgId = session.subscription
        ? (await stripe.subscriptions.retrieve(session.subscription as string)).metadata?.org_id
        : session.metadata?.org_id;
      const plan = session.subscription
        ? (await stripe.subscriptions.retrieve(session.subscription as string)).metadata?.plan
        : 'starter';

      if (orgId) {
        const planLimits = PLAN_LIMITS[plan as Plan] || PLAN_LIMITS.starter;
        await supabaseAdmin
          .from('organizations')
          .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            plan,
            minutes_limit: planLimits.minutes === -1 ? -1 : planLimits.minutes,
          })
          .eq('id', orgId);
      }
      break;
    }

    // Subscription updated (plan change, cancellation)
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;
      const plan = subscription.metadata?.plan || 'starter';
      const status = subscription.status;

      const updates: Record<string, unknown> = {
        stripe_subscription_id: subscription.id,
      };

      if (status === 'active') {
        const planLimits = PLAN_LIMITS[plan as Plan] || PLAN_LIMITS.starter;
        updates.plan = plan;
        updates.minutes_limit = planLimits.minutes === -1 ? -1 : planLimits.minutes;
      } else if (status === 'canceled' || status === 'unpaid') {
        updates.plan = 'starter';
        updates.minutes_limit = 200;
      }

      await supabaseAdmin
        .from('organizations')
        .update(updates)
        .eq('stripe_customer_id', customerId);
      break;
    }

    // Subscription deleted
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;

      await supabaseAdmin
        .from('organizations')
        .update({
          plan: 'starter',
          minutes_limit: 200,
          stripe_subscription_id: null,
        })
        .eq('stripe_customer_id', customerId);
      break;
    }

    // Invoice paid — reset monthly minutes at billing cycle start
    case 'invoice.paid': {
      const invoice = event.data.object;
      if (invoice.billing_reason === 'subscription_cycle') {
        const customerId = invoice.customer as string;
        await supabaseAdmin
          .from('organizations')
          .update({ minutes_used: 0 })
          .eq('stripe_customer_id', customerId);
      }
      break;
    }

    // Invoice payment failed
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const customerId = invoice.customer as string;

      // Log webhook event for the business owner
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (org) {
        await supabaseAdmin.from('webhook_events').insert({
          org_id: org.id,
          event_type: 'payment_failed',
          payload: {
            invoice_id: invoice.id,
            amount_due: invoice.amount_due,
            next_attempt: invoice.next_payment_attempt,
          },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
