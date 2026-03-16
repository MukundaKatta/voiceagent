import type { FastifyRequest, FastifyReply } from 'fastify';
import { supabase } from '../services/supabase.service.js';

export async function callHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as Record<string, string>;
  const calledNumber = body.To;
  const callerNumber = body.From;
  const callSid = body.CallSid;

  request.log.info({ callSid, calledNumber, callerNumber }, 'Incoming call');

  // Look up tenant by phone number
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('phone_number', calledNumber)
    .single();

  if (!org) {
    request.log.warn({ calledNumber }, 'No organization found for number');
    reply.type('text/xml').send(`
      <Response>
        <Say>Sorry, this number is not configured. Goodbye.</Say>
        <Hangup/>
      </Response>
    `);
    return;
  }

  // Create call record
  await supabase.from('calls').insert({
    org_id: org.id,
    twilio_call_sid: callSid,
    caller_phone: callerNumber,
    direction: 'inbound',
    status: 'ringing',
  });

  const wsUrl = process.env.VOICE_SERVER_WS_URL || 'wss://voice.yourdomain.com/ws';

  // Return TwiML with ConversationRelay
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay
      url="${wsUrl}?orgId=${org.id}&amp;callSid=${callSid}"
      voice="${org.voice_id || 'en-US-Neural2-F'}"
      language="${org.language || 'en-US'}"
      dtmfDetection="true"
      interruptible="true"
      ttsProvider="google"
      speechModel="telephony"
      welcomeGreeting="${escapeXml(org.greeting_prompt ? 'Hello! ' : 'Hello, thank you for calling ' + org.name + '. How can I help you today?')}"
    />
  </Connect>
</Response>`;

  reply.type('text/xml').send(twiml);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
