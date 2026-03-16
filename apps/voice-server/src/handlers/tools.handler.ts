import type { FastifyRequest, FastifyReply } from 'fastify';
import { supabase } from '../services/supabase.service.js';
import { CalendarService } from '../services/calendar.service.js';
import { SmsService } from '../services/sms.service.js';
import { BedrockService } from '../services/bedrock.service.js';

const calendarService = new CalendarService();
const smsService = new SmsService();

interface ToolUseInput {
  [key: string]: unknown;
}

export async function executeToolCall(
  toolName: string,
  input: ToolUseInput,
  state: { orgId: string; callSid: string; org: any },
  request: FastifyRequest
): Promise<string> {
  request.log.info({ toolName, input }, 'Executing tool call');

  switch (toolName) {
    case 'book_appointment': {
      const { customer_name, customer_phone, service, provider, date, time, duration_minutes } = input as any;
      const startTime = new Date(`${date}T${time}`);
      const endTime = new Date(startTime.getTime() + (duration_minutes || 60) * 60000);

      // Check availability via Google Calendar
      const isAvailable = await calendarService.checkAvailability(
        state.orgId,
        startTime,
        endTime
      );

      if (!isAvailable) {
        return JSON.stringify({ success: false, message: 'That time slot is not available.' });
      }

      // Create Google Calendar event
      const eventId = await calendarService.createEvent(state.orgId, {
        summary: `${service || 'Appointment'} - ${customer_name}`,
        start: startTime,
        end: endTime,
        description: `Booked via AI receptionist. Phone: ${customer_phone}`,
      });

      // Save appointment
      const { data: appointment } = await supabase.from('appointments').insert({
        org_id: state.orgId,
        call_id: (await supabase.from('calls').select('id').eq('twilio_call_sid', state.callSid).single()).data?.id,
        customer_name,
        customer_phone: customer_phone || '',
        service,
        provider,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        google_event_id: eventId,
      }).select().single();

      // Send confirmation SMS
      if (customer_phone) {
        await smsService.send(
          customer_phone,
          `Your ${service || 'appointment'} at ${state.org.name} is confirmed for ${startTime.toLocaleString()}. Reply CANCEL to cancel.`
        );
      }

      // Record action on the call
      await supabase.from('calls').update({
        actions_taken: [{ type: 'booked_appointment', details: { appointment_id: appointment?.id } }],
      }).eq('twilio_call_sid', state.callSid);

      return JSON.stringify({
        success: true,
        message: `Appointment booked for ${customer_name} on ${startTime.toLocaleString()}.`,
        appointment_id: appointment?.id,
      });
    }

    case 'transfer_call': {
      const { reason } = input as any;
      const transferTo = state.org.transfer_number;
      if (!transferTo) {
        return JSON.stringify({ success: false, message: 'No transfer number configured.' });
      }

      await supabase.from('calls').update({
        status: 'transferred',
        transferred_to: transferTo,
      }).eq('twilio_call_sid', state.callSid);

      return JSON.stringify({
        success: true,
        transferTo,
        message: `Transferring to ${transferTo}. Reason: ${reason}`,
        action: 'transfer',
      });
    }

    case 'send_sms': {
      const { to, message } = input as any;
      await smsService.send(to, message);
      return JSON.stringify({ success: true, message: 'SMS sent.' });
    }

    case 'lookup_info': {
      const { query } = input as any;
      const bedrockService = new BedrockService();
      // This is handled by knowledge retrieval in the main flow
      const { data: results } = await supabase.rpc('match_knowledge', {
        query_embedding: await bedrockService.generateEmbedding(query),
        match_threshold: 0.7,
        match_count: 3,
        p_org_id: state.orgId,
      });

      return JSON.stringify({
        success: true,
        results: results?.map((r: any) => ({ title: r.title, content: r.content })) || [],
      });
    }

    case 'take_message': {
      const { caller_name, message, urgency } = input as any;
      // Store as a webhook event for the business owner
      await supabase.from('webhook_events').insert({
        org_id: state.orgId,
        event_type: 'message_taken',
        payload: { caller_name, message, urgency, call_sid: state.callSid },
      });

      return JSON.stringify({ success: true, message: 'Message recorded. The business owner will be notified.' });
    }

    default:
      return JSON.stringify({ success: false, message: `Unknown tool: ${toolName}` });
  }
}

// Internal API: Generate embeddings
export async function embedHandler(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const { text } = request.body as { text: string };
  const bedrockService = new BedrockService();
  const embedding = await bedrockService.generateEmbedding(text);
  return { embedding };
}

// Internal API: Send SMS
export async function smsApiHandler(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const { to, body } = request.body as { to: string; body: string };
  const smsService = new SmsService();
  await smsService.send(to, body);
  return { success: true };
}
