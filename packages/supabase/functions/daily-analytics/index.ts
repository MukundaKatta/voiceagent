import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  // Get all orgs
  const { data: orgs } = await supabase.from('organizations').select('id');

  for (const org of orgs || []) {
    const { data: calls } = await supabase
      .from('calls')
      .select('*')
      .eq('org_id', org.id)
      .gte('created_at', `${dateStr}T00:00:00Z`)
      .lt('created_at', `${dateStr}T23:59:59Z`);

    if (!calls || calls.length === 0) continue;

    const analytics = {
      org_id: org.id,
      date: dateStr,
      total_calls: calls.length,
      answered_calls: calls.filter((c) => c.status === 'completed').length,
      missed_calls: calls.filter((c) => c.status === 'missed').length,
      transferred_calls: calls.filter((c) => c.status === 'transferred').length,
      avg_duration_seconds: calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / calls.length,
      total_minutes: calls.reduce((sum, c) => sum + (c.minutes_billed || 0), 0),
      appointments_booked: calls.filter((c) => c.actions_taken?.some((a: any) => a.type === 'booked_appointment')).length,
      positive_sentiment: calls.filter((c) => c.sentiment === 'positive').length,
      negative_sentiment: calls.filter((c) => c.sentiment === 'negative').length,
      top_intents: calls.reduce((acc: Record<string, number>, c) => {
        if (c.intent) acc[c.intent] = (acc[c.intent] || 0) + 1;
        return acc;
      }, {}),
    };

    await supabase.from('call_analytics').upsert(analytics, { onConflict: 'org_id,date' });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
