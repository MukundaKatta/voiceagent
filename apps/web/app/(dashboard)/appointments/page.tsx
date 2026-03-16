import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function AppointmentsPage() {
  const supabase = await createClient();
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(50);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Appointments</h2>
      <div className="space-y-2">
        {appointments?.map((apt) => (
          <Card key={apt.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{apt.customer_name}</p>
                <p className="text-sm text-muted-foreground">
                  {apt.service} {apt.provider ? `with ${apt.provider}` : ''}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(apt.start_time).toLocaleString()}
                </p>
              </div>
              <Badge variant={apt.status === 'confirmed' ? 'default' : 'secondary'}>{apt.status}</Badge>
            </CardContent>
          </Card>
        )) || <p className="text-muted-foreground">No upcoming appointments.</p>}
      </div>
    </div>
  );
}
