-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's org_ids
CREATE OR REPLACE FUNCTION auth.user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT org_id FROM public.users WHERE auth_uid = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Organizations: users can see their own org
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  USING (id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Owners can update their organization"
  ON organizations FOR UPDATE
  USING (id IN (
    SELECT org_id FROM users WHERE auth_uid = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Users: can see users in same org
CREATE POLICY "Users can view org members"
  ON users FOR SELECT
  USING (org_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Admins can manage users"
  ON users FOR ALL
  USING (org_id IN (
    SELECT org_id FROM users WHERE auth_uid = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Tenant isolation for all other tables
CREATE POLICY "tenant_isolation" ON knowledge_base
  FOR ALL USING (org_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "tenant_isolation" ON calls
  FOR ALL USING (org_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "tenant_isolation" ON appointments
  FOR ALL USING (org_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "tenant_isolation" ON contacts
  FOR ALL USING (org_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "tenant_isolation" ON call_analytics
  FOR ALL USING (org_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "tenant_isolation" ON webhook_events
  FOR ALL USING (org_id IN (SELECT auth.user_org_ids()));
