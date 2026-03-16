import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function CallsPage() {
  const supabase = await createClient();
  const { data: calls } = await supabase
    .from('calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Calls</h2>
      <div className="space-y-2">
        {calls?.map((call) => (
          <Card key={call.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{call.caller_name || call.caller_phone || 'Unknown'}</p>
                <p className="text-sm text-muted-foreground">{call.summary || 'No summary'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={call.sentiment === 'positive' ? 'default' : call.sentiment === 'negative' ? 'destructive' : 'secondary'}>
                  {call.sentiment || 'neutral'}
                </Badge>
                <Badge variant="outline">{call.status}</Badge>
              </div>
            </CardContent>
          </Card>
        )) || <p className="text-muted-foreground">No calls yet.</p>}
      </div>
    </div>
  );
}
