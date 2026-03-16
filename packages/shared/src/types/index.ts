export type Vertical = 'restaurant' | 'dental' | 'temple' | 'salon' | 'home_services' | 'general';
export type Plan = 'starter' | 'growth' | 'pro' | 'agency';
export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';
export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'ringing' | 'in_progress' | 'completed' | 'missed' | 'transferred' | 'voicemail' | 'failed';
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'urgent';
export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface BusinessHours {
  [day: string]: { open: string; close: string } | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  vertical: Vertical;
  phone_number: string | null;
  twilio_sid: string | null;
  timezone: string;
  business_hours: BusinessHours | null;
  greeting_prompt: string | null;
  voice_id: string;
  language: string;
  transfer_number: string | null;
  emergency_keywords: string[];
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: Plan;
  minutes_used: number;
  minutes_limit: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  org_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  auth_uid: string | null;
  created_at: string;
}

export interface KnowledgeBaseEntry {
  id: string;
  org_id: string;
  title: string;
  content: string;
  category: string | null;
  metadata: Record<string, unknown>;
  active: boolean;
  created_at: string;
}

export interface Call {
  id: string;
  org_id: string;
  twilio_call_sid: string | null;
  caller_phone: string | null;
  caller_name: string | null;
  direction: CallDirection;
  status: CallStatus;
  duration_seconds: number | null;
  minutes_billed: number | null;
  sentiment: Sentiment | null;
  intent: string | null;
  summary: string | null;
  transcript: TranscriptEntry[] | null;
  actions_taken: ActionTaken[] | null;
  recording_url: string | null;
  transferred_to: string | null;
  lead_score: number | null;
  follow_up_sent: boolean;
  metadata: Record<string, unknown>;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface TranscriptEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ActionTaken {
  type: string;
  details: Record<string, unknown>;
}

export interface Appointment {
  id: string;
  org_id: string;
  call_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  service: string | null;
  provider: string | null;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  google_event_id: string | null;
  reminder_sent: boolean;
  notes: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  org_id: string;
  phone: string;
  name: string | null;
  email: string | null;
  tags: string[];
  total_calls: number;
  last_call_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CallAnalytics {
  id: string;
  org_id: string;
  date: string;
  total_calls: number;
  answered_calls: number;
  missed_calls: number;
  transferred_calls: number;
  avg_duration_seconds: number | null;
  total_minutes: number | null;
  appointments_booked: number;
  positive_sentiment: number;
  negative_sentiment: number;
  top_intents: Record<string, number> | null;
}

// ConversationRelay WebSocket message types
export interface ConversationRelaySetup {
  type: 'setup';
  callSid: string;
  from: string;
  to: string;
  streamSid: string;
}

export interface ConversationRelayPrompt {
  type: 'prompt';
  voicePrompt: string;
  lang?: string;
  last?: boolean;
}

export interface ConversationRelayInterrupt {
  type: 'interrupt';
}

export interface ConversationRelayDtmf {
  type: 'dtmf';
  digit: string;
}

export interface ConversationRelayEnd {
  type: 'end';
  handoffData?: string;
}

export type ConversationRelayMessage =
  | ConversationRelaySetup
  | ConversationRelayPrompt
  | ConversationRelayInterrupt
  | ConversationRelayDtmf
  | ConversationRelayEnd;

// Tool definitions for Bedrock
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

// Voice server response to ConversationRelay
export interface VoiceResponse {
  type: 'text';
  token: string;
  last?: boolean;
}

export interface VoiceEndResponse {
  type: 'end';
  handoffData?: string;
}
