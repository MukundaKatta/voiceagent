import type { FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import type {
  ConversationRelayMessage,
  TranscriptEntry,
  Organization,
} from '@voiceagent/shared';
import { supabase } from '../services/supabase.service.js';
import { BedrockService } from '../services/bedrock.service.js';
import { KnowledgeService } from '../services/knowledge.service.js';
import { executeToolCall } from './tools.handler.js';
import { buildSystemPrompt } from '../prompts/system.prompt.js';

interface SessionState {
  orgId: string;
  callSid: string;
  org: Organization | null;
  conversationHistory: TranscriptEntry[];
  bedrockService: BedrockService;
  knowledgeService: KnowledgeService;
  isProcessing: boolean;
}

export async function conversationHandler(socket: WebSocket, request: FastifyRequest) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const orgId = url.searchParams.get('orgId') || '';
  const callSid = url.searchParams.get('callSid') || '';

  const state: SessionState = {
    orgId,
    callSid,
    org: null,
    conversationHistory: [],
    bedrockService: new BedrockService(),
    knowledgeService: new KnowledgeService(),
    isProcessing: false,
  };

  request.log.info({ orgId, callSid }, 'WebSocket connected');

  // Load org config
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single();

  state.org = org;

  // Update call status
  await supabase
    .from('calls')
    .update({ status: 'in_progress' })
    .eq('twilio_call_sid', callSid);

  socket.on('message', async (data) => {
    try {
      const message: ConversationRelayMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'prompt':
          await handlePrompt(socket, state, message.voicePrompt, request);
          break;

        case 'interrupt':
          state.isProcessing = false;
          request.log.info({ callSid }, 'User interrupted');
          break;

        case 'dtmf':
          request.log.info({ callSid, digit: message.digit }, 'DTMF received');
          // Handle DTMF (e.g., press 0 for operator)
          if (message.digit === '0' && state.org?.transfer_number) {
            socket.send(JSON.stringify({
              type: 'end',
              handoffData: JSON.stringify({
                reasonCode: 'live-agent',
                reason: 'Customer pressed 0 for operator',
              }),
            }));
          }
          break;

        case 'setup':
          request.log.info({ callSid }, 'ConversationRelay setup complete');
          break;

        case 'end':
          await handleCallEnd(state, request);
          break;
      }
    } catch (error) {
      request.log.error({ error, callSid }, 'Error processing WebSocket message');
    }
  });

  socket.on('close', async () => {
    request.log.info({ callSid }, 'WebSocket closed');
    await handleCallEnd(state, request);
  });
}

async function handlePrompt(
  socket: WebSocket,
  state: SessionState,
  userMessage: string,
  request: FastifyRequest
) {
  if (!state.org) return;

  state.isProcessing = true;

  // Add user message to history
  state.conversationHistory.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
  });

  // Check for emergency keywords
  const isEmergency = state.org.emergency_keywords?.some(
    (kw) => userMessage.toLowerCase().includes(kw.toLowerCase())
  );

  if (isEmergency && state.org.transfer_number) {
    socket.send(JSON.stringify({
      type: 'end',
      handoffData: JSON.stringify({
        reasonCode: 'live-agent',
        reason: 'Emergency keyword detected',
      }),
    }));
    return;
  }

  // Retrieve relevant knowledge
  const relevantKnowledge = await state.knowledgeService.search(
    state.orgId,
    userMessage
  );

  // Build system prompt
  const systemPrompt = buildSystemPrompt(state.org, relevantKnowledge);

  // Call Bedrock Claude
  try {
    const response = await state.bedrockService.converse(
      systemPrompt,
      state.conversationHistory,
      state.org
    );

    if (!state.isProcessing) return; // Interrupted

    // Handle tool use
    if (response.toolUse) {
      const toolResult = await executeToolCall(
        response.toolUse.name,
        response.toolUse.input,
        state,
        request
      );

      // Get follow-up response after tool execution
      state.conversationHistory.push({
        role: 'assistant',
        content: response.text || '',
        timestamp: new Date().toISOString(),
      });

      const followUp = await state.bedrockService.converseWithToolResult(
        systemPrompt,
        state.conversationHistory,
        response.toolUse,
        toolResult,
        state.org
      );

      if (state.isProcessing && followUp.text) {
        socket.send(JSON.stringify({ type: 'text', token: followUp.text, last: true }));
        state.conversationHistory.push({
          role: 'assistant',
          content: followUp.text,
          timestamp: new Date().toISOString(),
        });
      }
    } else if (response.text) {
      socket.send(JSON.stringify({ type: 'text', token: response.text, last: true }));
      state.conversationHistory.push({
        role: 'assistant',
        content: response.text,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    request.log.error({ error }, 'Bedrock conversation error');
    socket.send(JSON.stringify({
      type: 'text',
      token: "I'm sorry, I'm having trouble processing that. Could you please repeat?",
      last: true,
    }));
  }
}

async function handleCallEnd(state: SessionState, request: FastifyRequest) {
  if (state.conversationHistory.length === 0) return;

  try {
    // Generate call summary
    const summary = await state.bedrockService.summarizeCall(state.conversationHistory);

    // Detect intent and sentiment
    const analysis = await state.bedrockService.analyzeCall(state.conversationHistory);

    // Update call record
    await supabase
      .from('calls')
      .update({
        status: 'completed',
        transcript: state.conversationHistory,
        summary: summary,
        sentiment: analysis.sentiment,
        intent: analysis.intent,
        lead_score: analysis.leadScore,
        ended_at: new Date().toISOString(),
        duration_seconds: Math.round(
          (Date.now() - new Date(state.conversationHistory[0].timestamp).getTime()) / 1000
        ),
      })
      .eq('twilio_call_sid', state.callSid);

    // Update or create contact
    const callerPhone = await getCallerPhone(state.callSid);
    if (callerPhone) {
      await supabase.from('contacts').upsert(
        {
          org_id: state.orgId,
          phone: callerPhone,
          name: analysis.callerName || null,
          total_calls: 1,
          last_call_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,phone' }
      );
    }

    request.log.info({ callSid: state.callSid }, 'Call ended and summarized');
  } catch (error) {
    request.log.error({ error, callSid: state.callSid }, 'Error ending call');
  }
}

async function getCallerPhone(callSid: string): Promise<string | null> {
  const { data } = await supabase
    .from('calls')
    .select('caller_phone')
    .eq('twilio_call_sid', callSid)
    .single();
  return data?.caller_phone || null;
}
