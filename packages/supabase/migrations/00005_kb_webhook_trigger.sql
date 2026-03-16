-- Trigger to call embed-knowledge edge function when knowledge_base entries are inserted or updated
-- This uses Supabase's pg_net extension to call the edge function via HTTP

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to notify on knowledge base changes
CREATE OR REPLACE FUNCTION notify_knowledge_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT;
BEGIN
  -- Call the embed-knowledge edge function
  -- The URL is set via a Supabase config or environment variable
  edge_function_url := current_setting('app.edge_function_url', true);

  IF edge_function_url IS NOT NULL AND edge_function_url != '' THEN
    PERFORM net.http_post(
      url := edge_function_url || '/functions/v1/embed-knowledge',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'title', NEW.title,
          'content', NEW.content,
          'org_id', NEW.org_id
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on insert or content update
CREATE TRIGGER knowledge_base_embed_trigger
  AFTER INSERT OR UPDATE OF content, title ON knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION notify_knowledge_change();

-- Schedule daily analytics rollup (runs at midnight UTC)
-- Uses pg_cron if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'daily-analytics-rollup',
      '0 0 * * *',
      $$SELECT net.http_post(
        url := current_setting('app.edge_function_url', true) || '/functions/v1/daily-analytics',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := '{}'::jsonb
      )$$
    );

    -- Schedule appointment reminders (runs every hour)
    PERFORM cron.schedule(
      'appointment-reminders',
      '0 * * * *',
      $$SELECT net.http_post(
        url := current_setting('app.edge_function_url', true) || '/functions/v1/reminder-send',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := '{}'::jsonb
      )$$
    );
  END IF;
END;
$$;
