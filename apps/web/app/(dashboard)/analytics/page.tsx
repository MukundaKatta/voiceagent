import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: analytics } = await supabase
    .from('call_analytics')
    .select('*')
    .order('date', { ascending: false })
    .limit(30);

  const today = analytics?.[0];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Analytics</h2>
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Calls</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{today?.total_calls ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Answered</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{today?.answered_calls ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Appointments</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{today?.appointments_booked ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Avg Duration</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{today?.avg_duration_seconds ? `${Math.round(today.avg_duration_seconds)}s` : '—'}</p></CardContent>
        </Card>
      </div>
    </div>
  );
}
