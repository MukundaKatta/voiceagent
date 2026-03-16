import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_customer_id')
    .single();

  if (!org?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account' }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${new URL(request.url).origin}/billing`,
  });

  return NextResponse.redirect(session.url);
}
