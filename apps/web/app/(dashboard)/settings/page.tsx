import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SettingsForm } from './settings-form';

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .single();

  const calendarConnected = !!(org?.settings as any)?.google_tokens;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Settings</h2>

      <Card>
        <CardHeader><CardTitle>Business Information</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{org?.name || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone Number</p>
              <p className="font-medium">{org?.phone_number || 'Not assigned'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vertical</p>
              <p className="font-medium capitalize">{org?.vertical || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              <Badge>{org?.plan || 'starter'}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Timezone</p>
              <p className="font-medium">{org?.timezone || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Minutes Used</p>
              <p className="font-medium">{org?.minutes_used || 0} / {org?.minutes_limit === -1 ? 'Unlimited' : org?.minutes_limit || 200}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>AI Receptionist</CardTitle></CardHeader>
        <CardContent>
          <SettingsForm org={org} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Integrations</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Google Calendar</p>
              <p className="text-sm text-muted-foreground">
                {calendarConnected ? 'Connected — appointments sync automatically' : 'Connect to enable appointment booking'}
              </p>
            </div>
            {calendarConnected ? (
              <Badge variant="default">Connected</Badge>
            ) : (
              <a
                href={`${process.env.VOICE_SERVER_URL || 'http://localhost:8080'}/api/calendar/oauth?orgId=${org?.id}`}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Connect Calendar
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
