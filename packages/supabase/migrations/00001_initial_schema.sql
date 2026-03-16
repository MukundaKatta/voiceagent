-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Organizations (tenants)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  vertical TEXT NOT NULL CHECK (vertical IN (
    'restaurant','dental','temple','salon','home_services','general'
  )),
  phone_number TEXT,
  twilio_sid TEXT,
  timezone TEXT DEFAULT 'America/Los_Angeles',
  business_hours JSONB,
  greeting_prompt TEXT,
  voice_id TEXT DEFAULT 'alloy',
  language TEXT DEFAULT 'en-US',
  transfer_number TEXT,
  emergency_keywords TEXT[],
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT DEFAULT 'starter' CHECK (plan IN (
    'starter','growth','pro','agency'
  )),
  minutes_used INTEGER DEFAULT 0,
  minutes_limit INTEGER DEFAULT 200,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Users (multi-tenant)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN (
    'owner','admin','member','viewer'
  )),
  auth_uid UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Knowledge Base (RAG source documents)
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  embedding VECTOR(1024),
  metadata JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Calls
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  twilio_call_sid TEXT UNIQUE,
  caller_phone TEXT,
  caller_name TEXT,
  direction TEXT DEFAULT 'inbound' CHECK (direction IN (
    'inbound','outbound'
  )),
  status TEXT DEFAULT 'ringing' CHECK (status IN (
    'ringing','in_progress','completed','missed',
    'transferred','voicemail','failed'
  )),
  duration_seconds INTEGER,
  minutes_billed NUMERIC(6,2),
  sentiment TEXT CHECK (sentiment IN (
    'positive','neutral','negative','urgent'
  )),
  intent TEXT,
  summary TEXT,
  transcript JSONB,
  actions_taken JSONB,
  recording_url TEXT,
  transferred_to TEXT,
  lead_score INTEGER,
  follow_up_sent BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  service TEXT,
  provider TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'confirmed' CHECK (status IN (
    'confirmed','cancelled','completed','no_show'
  )),
  google_event_id TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Contacts (CRM-lite)
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  tags TEXT[],
  total_calls INTEGER DEFAULT 0,
  last_call_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, phone)
);

-- Call Analytics (daily rollups)
CREATE TABLE call_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_calls INTEGER DEFAULT 0,
  answered_calls INTEGER DEFAULT 0,
  missed_calls INTEGER DEFAULT 0,
  transferred_calls INTEGER DEFAULT 0,
  avg_duration_seconds NUMERIC(8,2),
  total_minutes NUMERIC(10,2),
  appointments_booked INTEGER DEFAULT 0,
  positive_sentiment INTEGER DEFAULT 0,
  negative_sentiment INTEGER DEFAULT 0,
  top_intents JSONB,
  UNIQUE(org_id, date)
);

-- Webhook Events
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_calls_org_created ON calls(org_id, created_at DESC);
CREATE INDEX idx_calls_status ON calls(org_id, status);
CREATE INDEX idx_appointments_org_time ON appointments(org_id, start_time);
CREATE INDEX idx_contacts_org_phone ON contacts(org_id, phone);
CREATE INDEX idx_kb_embedding ON knowledge_base
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_analytics_org_date ON call_analytics(org_id, date DESC);
CREATE INDEX idx_users_auth_uid ON users(auth_uid);
CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_orgs_phone ON organizations(phone_number);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
