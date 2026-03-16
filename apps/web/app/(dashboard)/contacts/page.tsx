import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';

export default async function ContactsPage() {
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .order('last_call_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Contacts</h2>
      <div className="space-y-2">
        {contacts?.map((contact) => (
          <Card key={contact.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{contact.name || contact.phone}</p>
                <p className="text-sm text-muted-foreground">{contact.phone}</p>
              </div>
              <p className="text-sm text-muted-foreground">{contact.total_calls} calls</p>
            </CardContent>
          </Card>
        )) || <p className="text-muted-foreground">No contacts yet.</p>}
      </div>
    </div>
  );
}
