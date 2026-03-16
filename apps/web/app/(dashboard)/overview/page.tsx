import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Calendar, TrendingUp, Clock } from 'lucide-react';

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  // Fetch today's analytics
  const { data: analytics } = await supabase
    .from('call_analytics')
    .select('*')
    .eq('date', today)
    .single();

  // Fetch org info for minutes
  const { data: org } = await supabase
    .from('organizations')
    .select('name, plan, minutes_used, minutes_limit')
    .single();

  // Recent calls
  const { data: recentCalls } = await supabase
    .from('calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  // Upcoming appointments
  const { data: upcomingApts } = await supabase
    .from('appointments')
    .select('*')
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(5);

  const minutesPercent = org?.minutes_limit && org.minutes_limit > 0
    ? Math.round((org.minutes_used / org.minutes_limit) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground">Welcome back! Here's today's overview.</p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics?.total_calls ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              {analytics?.missed_calls ?? 0} missed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics?.appointments_booked ?? 0}</p>
            <p className="text-xs text-muted-foreground">booked today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {analytics?.avg_duration_seconds
                ? `${Math.floor(analytics.avg_duration_seconds / 60)}:${String(Math.round(analytics.avg_duration_seconds % 60)).padStart(2, '0')}`
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground">per call</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Minutes Used</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{org?.minutes_used ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              of {org?.minutes_limit === -1 ? 'unlimited' : org?.minutes_limit ?? 200} ({minutesPercent}%)
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-secondary">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(minutesPercent, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent calls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Calls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentCalls && recentCalls.length > 0 ? recentCalls.map((call) => (
              <div key={call.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div>
                  <p className="text-sm font-medium">{call.caller_name || call.caller_phone || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{call.summary || 'No summary'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {call.sentiment && (
                    <Badge variant={call.sentiment === 'positive' ? 'default' : call.sentiment === 'negative' ? 'destructive' : 'secondary'} className="text-xs">
                      {call.sentiment}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">{call.status}</Badge>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">No calls today</p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingApts && upcomingApts.length > 0 ? upcomingApts.map((apt) => (
              <div key={apt.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div>
                  <p className="text-sm font-medium">{apt.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {apt.service}{apt.provider ? ` with ${apt.provider}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">{new Date(apt.start_time).toLocaleDateString()}</p>
                  <p className="text-xs text-muted-foreground">{new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">No upcoming appointments</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
