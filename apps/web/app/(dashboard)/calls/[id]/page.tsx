import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: call } = await supabase
    .from('calls')
    .select('*')
    .eq('id', id)
    .single();

  if (!call) notFound();

  const transcript = (call.transcript || []) as Array<{ role: string; content: string; timestamp: string }>;
  const actions = (call.actions_taken || []) as Array<{ type: string; details: Record<string, unknown> }>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/calls" className="text-sm text-muted-foreground hover:underline">&larr; Back to calls</Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{call.caller_name || call.caller_phone || 'Unknown Caller'}</h2>
          <p className="text-muted-foreground">{call.caller_phone}</p>
        </div>
        <div className="flex items-center gap-2">
          {call.sentiment && (
            <Badge variant={call.sentiment === 'positive' ? 'default' : call.sentiment === 'negative' ? 'destructive' : 'secondary'}>
              {call.sentiment}
            </Badge>
          )}
          <Badge variant="outline">{call.status}</Badge>
          {call.lead_score && <Badge variant="secondary">Score: {call.lead_score}</Badge>}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {/* Summary */}
          {call.summary && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Summary</CardTitle></CardHeader>
              <CardContent><p>{call.summary}</p></CardContent>
            </Card>
          )}

          {/* Transcript */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Transcript</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {transcript.length > 0 ? transcript.map((entry, i) => (
                <div key={i} className={`flex ${entry.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    entry.role === 'assistant'
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-primary text-primary-foreground'
                  }`}>
                    <p className="text-xs font-medium mb-1">{entry.role === 'assistant' ? 'AI Receptionist' : 'Caller'}</p>
                    <p className="text-sm">{entry.content}</p>
                    <p className="text-xs opacity-60 mt-1">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No transcript available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar info */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Direction</span>
                <span>{call.direction}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span>{call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, '0')}` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Intent</span>
                <span>{call.intent || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Started</span>
                <span>{new Date(call.started_at).toLocaleString()}</span>
              </div>
              {call.ended_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ended</span>
                  <span>{new Date(call.ended_at).toLocaleString()}</span>
                </div>
              )}
              {call.transferred_to && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transferred to</span>
                  <span>{call.transferred_to}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recording playback */}
          {call.recording_url && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Recording</CardTitle></CardHeader>
              <CardContent>
                <audio controls className="w-full" src={call.recording_url}>
                  Your browser does not support audio playback.
                </audio>
              </CardContent>
            </Card>
          )}

          {/* Actions taken */}
          {actions.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Actions Taken</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {actions.map((action, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{action.type.replace('_', ' ')}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Follow-up */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Follow-up</CardTitle></CardHeader>
            <CardContent>
              <Badge variant={call.follow_up_sent ? 'default' : 'outline'}>
                {call.follow_up_sent ? 'Sent' : 'Not sent'}
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
