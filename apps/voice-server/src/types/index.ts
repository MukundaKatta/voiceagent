// Re-export shared types and add voice-server-specific types
export type { ConversationRelayMessage, Organization, TranscriptEntry } from '@voiceagent/shared';

export interface CallSession {
  orgId: string;
  callSid: string;
  startedAt: Date;
  conversationHistory: Array<{ role: string; content: string; timestamp: string }>;
}
