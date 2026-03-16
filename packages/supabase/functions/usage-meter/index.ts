import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  const { org_id, minutes } = await req.json();

  // Update minutes used
  const { data: org } = await supabase
    .from('organizations')
    .select('minutes_used, minutes_limit, stripe_subscription_id')
    .eq('id', org_id)
    .single();

  if (!org) return new Response(JSON.stringify({ error: 'Org not found' }), { status: 404 });

  const newMinutes = org.minutes_used + minutes;
  await supabase
    .from('organizations')
    .update({ minutes_used: newMinutes })
    .eq('id', org_id);

  // If over limit and has Stripe, report overage
  if (org.minutes_limit > 0 && newMinutes > org.minutes_limit && org.stripe_subscription_id) {
    // Report to Stripe usage meter — handled by voice server
  }

  return new Response(JSON.stringify({ minutes_used: newMinutes, limit: org.minutes_limit }), { status: 200 });
});
