import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe/client';
import { createClient } from '@supabase/supabase-js';

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
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;
      const status = subscription.status;
      const plan = subscription.items.data[0]?.price?.lookup_key || 'starter';

      await supabaseAdmin
        .from('organizations')
        .update({
          plan: status === 'active' ? plan : 'starter',
          stripe_subscription_id: subscription.id,
        })
        .eq('stripe_customer_id', customerId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
