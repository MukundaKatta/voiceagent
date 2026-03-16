import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async () => {
  // Find appointments in the next 24 hours that haven't had reminders sent
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, organization:organizations(name, phone_number)')
    .eq('reminder_sent', false)
    .eq('status', 'confirmed')
    .lte('start_time', tomorrow.toISOString())
    .gte('start_time', new Date().toISOString());

  for (const apt of appointments || []) {
    // Send SMS reminder via voice server API
    try {
      await fetch(`${Deno.env.get('VOICE_SERVER_URL')}/api/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('INTERNAL_API_KEY')}` },
        body: JSON.stringify({
          to: apt.customer_phone,
          body: `Reminder: You have an appointment at ${apt.organization?.name} on ${new Date(apt.start_time).toLocaleString()}. ${apt.service ? `Service: ${apt.service}.` : ''} Reply CANCEL to cancel.`,
        }),
      });

      await supabase
        .from('appointments')
        .update({ reminder_sent: true })
        .eq('id', apt.id);
    } catch (error) {
      console.error(`Failed to send reminder for appointment ${apt.id}:`, error);
    }
  }

  return new Response(JSON.stringify({ sent: appointments?.length || 0 }), { status: 200 });
});
