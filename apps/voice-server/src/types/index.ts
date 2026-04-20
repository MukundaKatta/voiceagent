// Re-export shared types and add voice-server-specific types
export type { ConversationRelayMessage, Organization, TranscriptEntry } from '@voiceagent/shared';

export interface CallSession {
  orgId: string;
  callSid: string;
  startedAt: Date;
  conversationHistory: Array<{ role: string; content: string; timestamp: string }>;
}

export type CallState =
  | 'ringing'
  | 'greeting'
  | 'triage'
  | 'booking'
  | 'awaiting_input'
  | 'handoff'
  | 'callback'
  | 'voicemail'
  | 'timeout'
  | 'completed';

export interface CallTransition {
  from: CallState;
  to: CallState;
  reason: string;
}

export interface EscalationPlan {
  callSid: string;
  shouldEscalate: boolean;
  route: 'human' | 'voicemail' | 'self-serve';
  reason: string;
  outcome: 'resolved' | 'routed' | 'deferred';
  metadata: {
    requiresCallback: boolean;
    saveSummary: boolean;
    saveStructuredOutcome: boolean;
  };
}

export function createCallStateMachine(): CallTransition[] {
  return [
    { from: 'ringing', to: 'greeting', reason: 'call connected' },
    { from: 'greeting', to: 'triage', reason: 'assistant collecting intent' },
    { from: 'greeting', to: 'awaiting_input', reason: 'caller silent after greeting' },
    { from: 'awaiting_input', to: 'voicemail', reason: 'silence threshold exceeded' },
    { from: 'triage', to: 'booking', reason: 'appointment or reservation requested' },
    { from: 'triage', to: 'handoff', reason: 'high-risk or human-required request' },
    { from: 'triage', to: 'callback', reason: 'request deferred for later response' },
    { from: 'triage', to: 'voicemail', reason: 'business closed or uncertain outcome' },
    { from: 'handoff', to: 'callback', reason: 'transfer failed but callback captured' },
    { from: 'handoff', to: 'voicemail', reason: 'human transfer unavailable' },
    { from: 'callback', to: 'completed', reason: 'callback requested and summarized' },
    { from: 'booking', to: 'completed', reason: 'task resolved' },
    { from: 'handoff', to: 'completed', reason: 'human escalation accepted' },
    { from: 'voicemail', to: 'completed', reason: 'message captured' },
    { from: 'timeout', to: 'completed', reason: 'call abandoned after timeout' },
  ];
}

export function createEscalationPlan(input: {
  callSid: string;
  isOpen: boolean;
  confidence: number;
  requestedHuman?: boolean;
  repeatAttempts?: number;
}): EscalationPlan {
  if (!input.isOpen) {
    return {
      callSid: input.callSid,
      shouldEscalate: true,
      route: 'voicemail',
      reason: 'outside business hours',
      outcome: 'deferred',
      metadata: {
        requiresCallback: true,
        saveSummary: true,
        saveStructuredOutcome: true,
      },
    };
  }
  if (input.requestedHuman || input.confidence < 0.55 || (input.repeatAttempts ?? 0) >= 2) {
    return {
      callSid: input.callSid,
      shouldEscalate: true,
      route: 'human',
      reason: input.requestedHuman ? 'caller requested a human' : 'low confidence triage',
      outcome: 'routed',
      metadata: {
        requiresCallback: false,
        saveSummary: true,
        saveStructuredOutcome: true,
      },
    };
  }
  return {
    callSid: input.callSid,
    shouldEscalate: false,
    route: 'self-serve',
    reason: 'assistant can continue',
    outcome: 'resolved',
    metadata: {
      requiresCallback: false,
      saveSummary: true,
      saveStructuredOutcome: false,
    },
  };
}
