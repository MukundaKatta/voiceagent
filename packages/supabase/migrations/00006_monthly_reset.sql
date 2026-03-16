-- Function to reset minutes on the first of each month
-- This is called by Stripe invoice.paid webhook, but also available as a cron fallback

CREATE OR REPLACE FUNCTION reset_monthly_minutes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE organizations
  SET minutes_used = 0,
      updated_at = now()
  WHERE plan != 'starter'; -- Only reset for paid plans (starter resets manually)
END;
$$;

-- Add index for faster webhook event lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_type
  ON webhook_events(org_id, event_type, created_at DESC);

-- Add index for faster contact phone lookups across orgs
CREATE INDEX IF NOT EXISTS idx_calls_caller_phone
  ON calls(caller_phone, created_at DESC);

-- Partial index for active knowledge base entries (used in RAG)
CREATE INDEX IF NOT EXISTS idx_kb_active_org
  ON knowledge_base(org_id)
  WHERE active = true;
