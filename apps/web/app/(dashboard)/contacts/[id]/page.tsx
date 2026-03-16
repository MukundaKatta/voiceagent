import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single();

  if (!contact) notFound();

  // Get call history for this contact
  const { data: calls } = await supabase
    .from('calls')
    .select('*')
    .eq('caller_phone', contact.phone)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <Link href="/contacts" className="text-sm text-muted-foreground hover:underline">← Back to contacts</Link>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{contact.name || 'Unknown'}</h2>
          <p className="text-muted-foreground">{contact.phone}</p>
          {contact.email && <p className="text-muted-foreground">{contact.email}</p>}
        </div>
        <div className="flex items-center gap-2">
          {contact.tags?.map((tag: string) => (
            <Badge key={tag} variant="secondary">{tag}</Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Calls</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{contact.total_calls}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Last Call</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {contact.last_call_at ? new Date(contact.last_call_at).toLocaleDateString() : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{contact.notes || 'No notes'}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Call History</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {calls && calls.length > 0 ? calls.map((call) => (
            <Link key={call.id} href={`/calls/${call.id}`} className="block">
              <div className="flex items-center justify-between border-b pb-2 last:border-0 hover:bg-accent/50 rounded px-2 py-1">
                <div>
                  <p className="text-sm font-medium">{call.summary || 'No summary'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(call.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {call.sentiment && <Badge variant="secondary" className="text-xs">{call.sentiment}</Badge>}
                  <Badge variant="outline" className="text-xs">{call.status}</Badge>
                </div>
              </div>
            </Link>
          )) : (
            <p className="text-sm text-muted-foreground">No call history</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
