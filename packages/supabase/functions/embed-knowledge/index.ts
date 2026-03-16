import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  const { record } = await req.json();

  // Generate embedding using Bedrock (via fetch to our API) or use Supabase AI
  // For now, use a placeholder — in production, call Bedrock Titan embeddings
  const text = `${record.title} ${record.content}`;

  // Call AWS Bedrock Titan Embeddings
  const response = await fetch(`${Deno.env.get('VOICE_SERVER_URL')}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('INTERNAL_API_KEY')}` },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    return new Response(JSON.stringify({ error: 'Embedding failed' }), { status: 500 });
  }

  const { embedding } = await response.json();

  await supabase
    .from('knowledge_base')
    .update({ embedding })
    .eq('id', record.id);

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
