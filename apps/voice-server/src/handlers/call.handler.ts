import type { FastifyRequest, FastifyReply } from 'fastify';
import { supabase } from '../services/supabase.service.js';
import { isWithinBusinessHours } from '@voiceagent/shared';
import { createEscalationPlan } from '../types/index.js';

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
    reply.type('text/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, this number is not currently in service. Goodbye.</Say>
  <Hangup/>
</Response>`
    );
    return;
  }

  // Look up caller in contacts
  const { data: contact } = await supabase
    .from('contacts')
    .select('name')
    .eq('org_id', org.id)
    .eq('phone', callerNumber)
    .single();

  // Create call record
  await supabase.from('calls').insert({
    org_id: org.id,
    twilio_call_sid: callSid,
    caller_phone: callerNumber,
    caller_name: contact?.name || null,
    direction: 'inbound',
    status: 'ringing',
  });

  // Check business hours
  const isOpen = isWithinBusinessHours(org.business_hours, org.timezone);
  const escalation = createEscalationPlan({
    callSid,
    isOpen,
    confidence: isOpen ? 0.85 : 0.2,
  });

  // Build welcome greeting
  let greeting: string;
  if (!isOpen) {
    greeting = `Thank you for calling ${org.name}. We are currently closed. Our AI assistant can still help you with general questions or you can leave a message.`;
  } else if (contact?.name) {
    greeting = `Welcome back ${contact.name}! Thank you for calling ${org.name}. How can I help you today?`;
  } else {
    greeting = `Hello, thank you for calling ${org.name}. How can I help you today?`;
  }

  const wsUrl = process.env.VOICE_SERVER_WS_URL || 'wss://voice.yourdomain.com/ws';
  const statusCallbackUrl = process.env.VOICE_SERVER_URL
    ? `${process.env.VOICE_SERVER_URL}/voice/status`
    : '';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay
      url="${wsUrl}?orgId=${escapeXml(org.id)}&amp;callSid=${escapeXml(callSid)}&amp;isOpen=${isOpen}"
      voice="${escapeXml(org.voice_id || 'en-US-Neural2-F')}"
      language="${escapeXml(org.language || 'en-US')}"
      dtmfDetection="true"
      interruptible="true"
      ttsProvider="google"
      speechModel="telephony"
      welcomeGreeting="${escapeXml(greeting)}"
      debug="${escapeXml(JSON.stringify({
        escalationRoute: escalation.route,
        escalationOutcome: escalation.outcome,
        requiresCallback: escalation.metadata.requiresCallback,
      }))}"
      transcriptionProvider="deepgram"
      profanityFilter="true"
    />
  </Connect>
</Response>`;

  reply.type('text/xml').send(twiml);
}

/**
 * Twilio call status callback handler.
 * Receives updates when call status changes (ringing, in-progress, completed, etc.)
 */
export async function callStatusHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as Record<string, string>;
  const callSid = body.CallSid;
  const callStatus = body.CallStatus;
  const duration = body.CallDuration;
  const recordingUrl = body.RecordingUrl;

  request.log.info({ callSid, callStatus, duration }, 'Call status update');

  const updates: Record<string, unknown> = {};

  switch (callStatus) {
    case 'completed':
      updates.status = 'completed';
      updates.ended_at = new Date().toISOString();
      if (duration) updates.duration_seconds = parseInt(duration, 10);
      break;
    case 'busy':
    case 'no-answer':
      updates.status = 'missed';
      updates.ended_at = new Date().toISOString();
      break;
    case 'failed':
      updates.status = 'failed';
      updates.ended_at = new Date().toISOString();
      break;
  }

  if (recordingUrl) {
    updates.recording_url = recordingUrl;
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from('calls')
      .update(updates)
      .eq('twilio_call_sid', callSid);
  }

  reply.status(200).send({ received: true });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
