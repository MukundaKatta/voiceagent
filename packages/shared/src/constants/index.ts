export const PLAN_LIMITS = {
  starter: { minutes: 200, phoneNumbers: 1, features: ['faq'] },
  growth: { minutes: 500, phoneNumbers: 1, features: ['faq', 'appointments', 'sms', 'crm'] },
  pro: { minutes: -1, phoneNumbers: 3, features: ['faq', 'appointments', 'sms', 'crm', 'multilingual', 'custom_voice', 'analytics'] },
  agency: { minutes: -1, phoneNumbers: 10, features: ['faq', 'appointments', 'sms', 'crm', 'multilingual', 'custom_voice', 'analytics', 'whitelabel', 'api'] },
} as const;

export const PLAN_PRICES = {
  starter: 9900,   // cents
  growth: 19900,
  pro: 29900,
  agency: 49900,
} as const;

export const OVERAGE_RATE_CENTS = 15; // $0.15 per minute

export const VERTICALS = ['restaurant', 'dental', 'temple', 'salon', 'home_services', 'general'] as const;

export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'es-US', label: 'Spanish (US)' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'te-IN', label: 'Telugu' },
] as const;

export const VOICE_OPTIONS = [
  { id: 'en-US-Neural2-F', label: 'Female (Natural)', lang: 'en-US' },
  { id: 'en-US-Neural2-D', label: 'Male (Natural)', lang: 'en-US' },
  { id: 'es-US-Neural2-A', label: 'Female (Spanish)', lang: 'es-US' },
] as const;

export const MAX_CONVERSATION_HISTORY = 20;
export const MAX_TOKENS_RESPONSE = 300;
export const BEDROCK_MODEL_ID = 'anthropic.claude-sonnet-4-20250514-v1:0';
export const EMBEDDING_MODEL_ID = 'amazon.titan-embed-text-v2:0';
export const EMBEDDING_DIMENSIONS = 1024;
