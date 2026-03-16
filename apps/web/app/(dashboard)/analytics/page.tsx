import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsCharts } from './analytics-charts';

export default async function AnalyticsPage() {
  const supabase = await createClient();

  // Get last 30 days of analytics
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: analytics } = await supabase
    .from('call_analytics')
    .select('*')
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true });

  // Get org minutes
  const { data: org } = await supabase
    .from('organizations')
    .select('minutes_used, minutes_limit, plan')
    .single();

  // Calculate totals
  const totals = (analytics || []).reduce(
    (acc, day) => ({
      calls: acc.calls + (day.total_calls || 0),
      answered: acc.answered + (day.answered_calls || 0),
      missed: acc.missed + (day.missed_calls || 0),
      transferred: acc.transferred + (day.transferred_calls || 0),
      appointments: acc.appointments + (day.appointments_booked || 0),
      minutes: acc.minutes + (day.total_minutes || 0),
      positive: acc.positive + (day.positive_sentiment || 0),
      negative: acc.negative + (day.negative_sentiment || 0),
    }),
    { calls: 0, answered: 0, missed: 0, transferred: 0, appointments: 0, minutes: 0, positive: 0, negative: 0 }
  );

  const answerRate = totals.calls > 0 ? Math.round((totals.answered / totals.calls) * 100) : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Analytics</h2>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Calls (30d)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totals.calls}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Answer Rate</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{answerRate}%</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Appointments Booked</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totals.appointments}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Minutes Used</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{Math.round(totals.minutes)}</p>
            <p className="text-xs text-muted-foreground">of {org?.minutes_limit === -1 ? '\u221E' : org?.minutes_limit || 200}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <AnalyticsCharts data={analytics || []} totals={totals} />
    </div>
  );
}
