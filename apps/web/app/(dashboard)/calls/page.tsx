import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CallFilters } from './call-filters';
import Link from 'next/link';

interface SearchParams {
  status?: string;
  sentiment?: string;
  q?: string;
}

export default async function CallsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (params.status) query = query.eq('status', params.status);
  if (params.sentiment) query = query.eq('sentiment', params.sentiment);
  if (params.q) query = query.or(`caller_name.ilike.%${params.q}%,caller_phone.ilike.%${params.q}%,summary.ilike.%${params.q}%`);

  const { data: calls } = await query;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Calls</h2>
      <CallFilters />
      <div className="space-y-2">
        {calls && calls.length > 0 ? calls.map((call) => (
          <Link key={call.id} href={`/calls/${call.id}`}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{call.caller_name || call.caller_phone || 'Unknown'}</p>
                    {call.intent && <Badge variant="outline" className="text-xs">{call.intent}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{call.summary || 'No summary'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(call.created_at).toLocaleString()}
                    {call.duration_seconds ? ` · ${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, '0')}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {call.lead_score && (
                    <span className="text-xs text-muted-foreground">Score: {call.lead_score}</span>
                  )}
                  {call.sentiment && (
                    <Badge variant={
                      call.sentiment === 'positive' ? 'default' :
                      call.sentiment === 'negative' ? 'destructive' :
                      call.sentiment === 'urgent' ? 'destructive' : 'secondary'
                    }>
                      {call.sentiment}
                    </Badge>
                  )}
                  <Badge variant="outline">{call.status}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        )) : (
          <p className="text-muted-foreground">No calls found.</p>
        )}
      </div>
    </div>
  );
}
