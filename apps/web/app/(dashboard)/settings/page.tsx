import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .single();

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Settings</h2>
      <Card>
        <CardHeader><CardTitle>Business Information</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p><span className="font-medium">Name:</span> {org?.name || '—'}</p>
          <p><span className="font-medium">Phone:</span> {org?.phone_number || '—'}</p>
          <p><span className="font-medium">Vertical:</span> {org?.vertical || '—'}</p>
          <p><span className="font-medium">Plan:</span> {org?.plan || '—'}</p>
          <p><span className="font-medium">Timezone:</span> {org?.timezone || '—'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
