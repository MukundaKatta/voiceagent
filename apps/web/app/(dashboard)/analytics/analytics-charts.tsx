'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface DayData {
  date: string;
  total_calls: number;
  answered_calls: number;
  missed_calls: number;
  transferred_calls: number;
  appointments_booked: number;
  avg_duration_seconds: number | null;
  total_minutes: number | null;
  positive_sentiment: number;
  negative_sentiment: number;
  top_intents: Record<string, number> | null;
}

interface Totals {
  calls: number;
  answered: number;
  missed: number;
  transferred: number;
  appointments: number;
  minutes: number;
  positive: number;
  negative: number;
}

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#ec4899'];

export function AnalyticsCharts({ data, totals }: { data: DayData[]; totals: Totals }) {
  // Format dates for display
  const chartData = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  // Aggregate top intents across all days
  const intentMap: Record<string, number> = {};
  data.forEach((d) => {
    if (d.top_intents) {
      Object.entries(d.top_intents).forEach(([intent, count]) => {
        intentMap[intent] = (intentMap[intent] || 0) + count;
      });
    }
  });
  const intentData = Object.entries(intentMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  // Sentiment pie data
  const sentimentData = [
    { name: 'Positive', value: totals.positive, color: '#16a34a' },
    { name: 'Neutral', value: Math.max(0, totals.calls - totals.positive - totals.negative), color: '#94a3b8' },
    { name: 'Negative', value: totals.negative, color: '#dc2626' },
  ].filter((d) => d.value > 0);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Calls over time */}
      <Card className="md:col-span-2">
        <CardHeader><CardTitle className="text-lg">Calls Over Time</CardTitle></CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="answered_calls" stackId="1" stroke="#16a34a" fill="#16a34a" fillOpacity={0.6} name="Answered" />
              <Area type="monotone" dataKey="missed_calls" stackId="1" stroke="#dc2626" fill="#dc2626" fillOpacity={0.6} name="Missed" />
              <Area type="monotone" dataKey="transferred_calls" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="Transferred" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Appointments booked */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Appointments Booked</CardTitle></CardHeader>
        <CardContent className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="appointments_booked" fill="#2563eb" radius={[4, 4, 0, 0]} name="Appointments" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sentiment breakdown */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Sentiment Breakdown</CardTitle></CardHeader>
        <CardContent className="h-[250px]">
          {sentimentData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">No sentiment data yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top intents */}
      {intentData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Top Intents</CardTitle></CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={intentData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Count">
                  {intentData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Avg duration trend */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Avg Call Duration</CardTitle></CardHeader>
        <CardContent className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.floor(v / 60)}m`} />
              <Tooltip formatter={(value: number) => `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}`} />
              <Area type="monotone" dataKey="avg_duration_seconds" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} name="Avg Duration" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
