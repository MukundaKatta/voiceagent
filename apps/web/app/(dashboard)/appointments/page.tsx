import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppointmentActions } from './appointment-actions';

export default async function AppointmentsPage() {
  const supabase = await createClient();

  const { data: upcoming } = await supabase
    .from('appointments')
    .select('*')
    .gte('start_time', new Date().toISOString())
    .in('status', ['confirmed'])
    .order('start_time', { ascending: true })
    .limit(50);

  const { data: past } = await supabase
    .from('appointments')
    .select('*')
    .lt('start_time', new Date().toISOString())
    .order('start_time', { ascending: false })
    .limit(20);

  const statusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'default';
      case 'completed': return 'secondary';
      case 'cancelled': return 'destructive';
      case 'no_show': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Appointments</h2>

      <div>
        <h3 className="text-lg font-semibold mb-3">Upcoming</h3>
        <div className="space-y-2">
          {upcoming && upcoming.length > 0 ? upcoming.map((apt) => (
            <Card key={apt.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <p className="font-medium">{apt.customer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {apt.service}{apt.provider ? ` with ${apt.provider}` : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(apt.start_time).toLocaleDateString()} at{' '}
                    {new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' — '}
                    {new Date(apt.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-sm text-muted-foreground">{apt.customer_phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusColor(apt.status) as any}>{apt.status}</Badge>
                  <AppointmentActions id={apt.id} status={apt.status} />
                </div>
              </CardContent>
            </Card>
          )) : (
            <p className="text-muted-foreground">No upcoming appointments.</p>
          )}
        </div>
      </div>

      {past && past.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Past</h3>
          <div className="space-y-2">
            {past.map((apt) => (
              <Card key={apt.id} className="opacity-75">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{apt.customer_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {apt.service} — {new Date(apt.start_time).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={statusColor(apt.status) as any}>{apt.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
