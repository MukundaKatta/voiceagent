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
import { AnalyticsService } from '../services/analytics.service.js';
import { executeToolCall } from './tools.handler.js';
import { buildSystemPrompt } from '../prompts/system.prompt.js';
import { createEscalationPlan } from '../types/index.js';

const SENTENCE_DELIMITERS = /[.!?;]\s/;

interface SessionState {
  orgId: string;
  callSid: string;
  org: Organization | null;
  conversationHistory: TranscriptEntry[];
  bedrockService: BedrockService;
  knowledgeService: KnowledgeService;
  analyticsService: AnalyticsService;
  isProcessing: boolean;
  activeAbortController: AbortController | null;
  callEnded: boolean;
  startedAt: number;
  repeatAttempts: number;
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
    analyticsService: new AnalyticsService(),
    isProcessing: false,
    activeAbortController: null,
    callEnded: false,
    startedAt: Date.now(),
    repeatAttempts: 0,
  };

  request.log.info({ orgId, callSid }, 'WebSocket connected');

  // Load org config
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single();

  if (!org) {
    request.log.error({ orgId }, 'Organization not found, closing WebSocket');
    socket.close();
    return;
  }

  state.org = org;

  // Update call status to in_progress
  await supabase
    .from('calls')
    .update({ status: 'in_progress' })
    .eq('twilio_call_sid', callSid);

  socket.on('message', async (data) => {
    try {
      const message: ConversationRelayMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'setup':
          request.log.info({ callSid, from: (message as any).from }, 'ConversationRelay setup');
          break;

        case 'prompt':
          await handlePrompt(socket, state, message.voicePrompt, request);
          break;

        case 'interrupt':
          handleInterrupt(state, request);
          break;

        case 'dtmf':
          handleDtmf(socket, state, message.digit, request);
          break;

        case 'end':
          request.log.info({ callSid }, 'ConversationRelay ended');
          await handleCallEnd(socket, state, request);
          break;
      }
    } catch (error) {
      request.log.error({ error, callSid }, 'Error processing WebSocket message');
    }
  });

  socket.on('close', async () => {
    request.log.info({ callSid }, 'WebSocket disconnected');
    await handleCallEnd(socket, state, request);
  });

  socket.on('error', (error) => {
    request.log.error({ error, callSid }, 'WebSocket error');
  });
}

function handleInterrupt(state: SessionState, request: FastifyRequest) {
  state.isProcessing = false;
  if (state.activeAbortController) {
    state.activeAbortController.abort();
    state.activeAbortController = null;
  }
  request.log.info({ callSid: state.callSid }, 'User interrupted — stream aborted');
}

function handleDtmf(socket: WebSocket, state: SessionState, digit: string, request: FastifyRequest) {
  request.log.info({ callSid: state.callSid, digit }, 'DTMF received');

  // Press 0 for operator
  if (digit === '0' && state.org?.transfer_number) {
    sendHandoff(socket, state, 'live-agent', 'Customer pressed 0 for operator');
  }

  // Press 9 for repeat
  if (digit === '9' && state.conversationHistory.length > 0) {
    const lastAssistant = [...state.conversationHistory]
      .reverse()
      .find((e) => e.role === 'assistant');
    if (lastAssistant) {
      socket.send(JSON.stringify({ type: 'text', token: lastAssistant.content, last: true }));
    }
  }
}

function sendHandoff(socket: WebSocket, state: SessionState, reasonCode: string, reason: string) {
  socket.send(JSON.stringify({
    type: 'end',
    handoffData: JSON.stringify({
      reasonCode,
      reason,
      transferTo: state.org?.transfer_number,
    }),
  }));
}

/**
 * Sends text to ConversationRelay in sentence-sized chunks.
 * ConversationRelay TTS sounds more natural with complete sentences.
 */
function sendBuffered(socket: WebSocket, buffer: { text: string }, flush: boolean) {
  if (!buffer.text) return;

  if (flush) {
    // Send everything remaining
    socket.send(JSON.stringify({ type: 'text', token: buffer.text.trim(), last: true }));
    buffer.text = '';
    return;
  }

  // Look for sentence boundaries
  const match = buffer.text.match(SENTENCE_DELIMITERS);
  if (match && match.index !== undefined) {
    const splitAt = match.index + match[0].length;
    const sentence = buffer.text.slice(0, splitAt).trim();
    buffer.text = buffer.text.slice(splitAt);
    if (sentence) {
      socket.send(JSON.stringify({ type: 'text', token: sentence, last: false }));
    }
  }
}

async function handlePrompt(
  socket: WebSocket,
  state: SessionState,
  userMessage: string,
  request: FastifyRequest
) {
  if (!state.org) return;

  // Cancel any in-flight stream
  if (state.activeAbortController) {
    state.activeAbortController.abort();
    state.activeAbortController = null;
  }

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
    request.log.warn({ callSid: state.callSid }, 'Emergency keyword detected — transferring');
    socket.send(JSON.stringify({
      type: 'text',
      token: "I'm connecting you to someone right away. Please hold.",
      last: true,
    }));
    sendHandoff(socket, state, 'live-agent', 'Emergency keyword detected');
    return;
  }

  // Retrieve relevant knowledge
  const relevantKnowledge = await state.knowledgeService.search(state.orgId, userMessage);

  // Build system prompt
  const systemPrompt = buildSystemPrompt(state.org, relevantKnowledge);

  try {
    const buffer = { text: '' };

    const abortController = await state.bedrockService.converseStream(
      systemPrompt,
      state.conversationHistory,
      state.org,
      {
        onToken(token: string) {
          if (!state.isProcessing) return;
          buffer.text += token;
          sendBuffered(socket, buffer, false);
        },

        onComplete(fullText: string) {
          if (!state.isProcessing) return;
          // Flush remaining buffer
          sendBuffered(socket, buffer, true);
          state.conversationHistory.push({
            role: 'assistant',
            content: fullText,
            timestamp: new Date().toISOString(),
          });
          state.isProcessing = false;
          state.activeAbortController = null;
        },

        async onToolUse(toolUse) {
          if (!state.isProcessing) return;
          request.log.info({ tool: toolUse.name }, 'Tool call from stream');

          const toolResult = await executeToolCall(
            toolUse.name,
            toolUse.input,
            state,
            request
          );

          // Check if this is a transfer action
          const parsed = JSON.parse(toolResult);
          if (parsed.action === 'transfer' && parsed.transferTo) {
            socket.send(JSON.stringify({
              type: 'text',
              token: "I'm transferring you now. One moment please.",
              last: true,
            }));
            sendHandoff(socket, state, 'live-agent', parsed.message);
            return;
          }

          // Get follow-up response after tool execution (non-streaming, since it's a short response)
          const followUp = await state.bedrockService.converseWithToolResult(
            systemPrompt,
            state.conversationHistory,
            toolUse,
            toolResult,
            state.org!
          );

          if (state.isProcessing && followUp.text) {
            socket.send(JSON.stringify({ type: 'text', token: followUp.text, last: true }));
            state.conversationHistory.push({
              role: 'assistant',
              content: followUp.text,
              timestamp: new Date().toISOString(),
            });
          }

          state.isProcessing = false;
          state.activeAbortController = null;
        },

        onError(error: Error) {
          request.log.error({ error }, 'Bedrock stream error');
          state.repeatAttempts += 1;
          if (state.isProcessing) {
            socket.send(JSON.stringify({
              type: 'text',
              token: "I'm sorry, I had trouble with that. Could you say that again?",
              last: true,
            }));
          }
          state.isProcessing = false;
          state.activeAbortController = null;
        },
      }
    );

    state.activeAbortController = abortController;
  } catch (error) {
    request.log.error({ error }, 'Failed to start Bedrock stream');
    socket.send(JSON.stringify({
      type: 'text',
      token: "I'm sorry, I'm having trouble right now. Could you please repeat that?",
      last: true,
    }));
    state.isProcessing = false;
  }
}

async function handleCallEnd(socket: WebSocket, state: SessionState, request: FastifyRequest) {
  // Prevent double execution
  if (state.callEnded) return;
  state.callEnded = true;

  // Cancel any in-flight stream
  if (state.activeAbortController) {
    state.activeAbortController.abort();
    state.activeAbortController = null;
  }

  if (state.conversationHistory.length === 0) {
    // Mark as missed if no conversation happened
    await supabase
      .from('calls')
      .update({ status: 'missed', ended_at: new Date().toISOString() })
      .eq('twilio_call_sid', state.callSid);
    return;
  }

  try {
    const durationSeconds = Math.round((Date.now() - state.startedAt) / 1000);
    const minutesBilled = Math.ceil(durationSeconds / 60);
    const escalation = createEscalationPlan({
      callSid: state.callSid,
      isOpen: true,
      confidence: state.repeatAttempts > 1 ? 0.4 : 0.8,
      repeatAttempts: state.repeatAttempts,
    });

    // Run summary and analysis in parallel
    const [summary, analysis] = await Promise.all([
      state.bedrockService.summarizeCall(state.conversationHistory),
      state.bedrockService.analyzeCall(state.conversationHistory),
    ]);

    // Get caller phone for contact upsert
    const { data: callRecord } = await supabase
      .from('calls')
      .select('caller_phone')
      .eq('twilio_call_sid', state.callSid)
      .single();

    // Update call record
    await supabase
      .from('calls')
      .update({
        status: 'completed',
        transcript: state.conversationHistory,
        summary,
        sentiment: analysis.sentiment,
        intent: analysis.intent,
        lead_score: analysis.leadScore,
        duration_seconds: durationSeconds,
        minutes_billed: minutesBilled,
        ended_at: new Date().toISOString(),
      })
      .eq('twilio_call_sid', state.callSid);

    // Track minutes usage
    await state.analyticsService.recordCallMinutes(state.orgId, durationSeconds);

    // Upsert contact
    if (callRecord?.caller_phone) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('total_calls')
        .eq('org_id', state.orgId)
        .eq('phone', callRecord.caller_phone)
        .single();

      await supabase.from('contacts').upsert(
        {
          org_id: state.orgId,
          phone: callRecord.caller_phone,
          name: analysis.callerName || undefined,
          total_calls: (existing?.total_calls || 0) + 1,
          last_call_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,phone' }
      );
    }

    request.log.info(
      {
        callSid: state.callSid,
        duration: durationSeconds,
        sentiment: analysis.sentiment,
        outcome: escalation.outcome,
        fallback: escalation.route,
      },
      'Call completed and summarized'
    );
  } catch (error) {
    request.log.error({ error, callSid: state.callSid }, 'Error during call end processing');

    // Still try to mark the call as completed
    await supabase
      .from('calls')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('twilio_call_sid', state.callSid);
  }
}
