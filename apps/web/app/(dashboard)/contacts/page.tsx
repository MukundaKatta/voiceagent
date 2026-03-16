import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ContactSearch } from './contact-search';
import Link from 'next/link';

interface SearchParams {
  q?: string;
}

export default async function ContactsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('contacts')
    .select('*')
    .order('last_call_at', { ascending: false })
    .limit(50);

  if (params.q) {
    query = query.or(`name.ilike.%${params.q}%,phone.ilike.%${params.q}%,email.ilike.%${params.q}%`);
  }

  const { data: contacts } = await query;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Contacts</h2>
      <ContactSearch />
      <div className="space-y-2">
        {contacts && contacts.length > 0 ? contacts.map((contact) => (
          <Link key={contact.id} href={`/contacts/${contact.id}`}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{contact.name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{contact.phone}</p>
                  {contact.email && <p className="text-sm text-muted-foreground">{contact.email}</p>}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {contact.tags?.map((tag: string) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                  <span className="text-muted-foreground">{contact.total_calls} calls</span>
                  {contact.last_call_at && (
                    <span className="text-muted-foreground">
                      Last: {new Date(contact.last_call_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        )) : (
          <p className="text-muted-foreground">No contacts yet.</p>
        )}
      </div>
    </div>
  );
}
