-- Similarity search for knowledge base RAG
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding VECTOR(1024),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  p_org_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE kb.active = true
    AND (p_org_id IS NULL OR kb.org_id = p_org_id)
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Increment minutes used for an organization
CREATE OR REPLACE FUNCTION increment_minutes_used(
  p_org_id UUID,
  p_minutes INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE organizations
  SET minutes_used = minutes_used + p_minutes,
      updated_at = now()
  WHERE id = p_org_id;
END;
$$;

-- Auto-create user record on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (auth_uid, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'owner'
  );
  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
