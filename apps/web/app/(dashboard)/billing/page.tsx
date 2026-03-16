import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PLAN_LIMITS } from '@voiceagent/shared';
import type { Plan } from '@voiceagent/shared';
import { UpgradeButton } from './upgrade-button';

export default async function BillingPage() {
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .single();

  const plan = (org?.plan || 'starter') as Plan;
  const planInfo = PLAN_LIMITS[plan];
  const minutesPercent = planInfo.minutes > 0
    ? Math.round(((org?.minutes_used || 0) / planInfo.minutes) * 100)
    : 0;

  const plans = [
    { name: 'Starter', key: 'starter', price: '$99', minutes: '200 min', features: ['1 phone number', 'Basic FAQ', 'Call transcripts'] },
    { name: 'Growth', key: 'growth', price: '$199', minutes: '500 min', features: ['Appointment booking', 'SMS follow-up', 'CRM sync', 'Analytics'] },
    { name: 'Pro', key: 'pro', price: '$299', minutes: 'Unlimited', features: ['Multi-language', 'Custom voice', 'Advanced analytics', '3 phone numbers'] },
    { name: 'Agency', key: 'agency', price: '$499', minutes: 'Unlimited', features: ['White-label', '10 sub-accounts', 'API access', 'Priority support'] },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Billing</h2>

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            You are on the <span className="font-semibold capitalize">{plan}</span> plan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Minutes Used</span>
              <span>{org?.minutes_used || 0} / {planInfo.minutes === -1 ? '∞' : planInfo.minutes}</span>
            </div>
            {planInfo.minutes > 0 && (
              <div className="h-3 w-full rounded-full bg-secondary">
                <div
                  className={`h-3 rounded-full transition-all ${minutesPercent > 90 ? 'bg-destructive' : 'bg-primary'}`}
                  style={{ width: `${Math.min(minutesPercent, 100)}%` }}
                />
              </div>
            )}
            {minutesPercent > 90 && planInfo.minutes > 0 && (
              <p className="text-xs text-destructive mt-1">
                You're running low on minutes. Overage is billed at $0.15/min.
              </p>
            )}
          </div>
          <form action="/api/billing/portal" method="POST">
            <Button type="submit" variant="outline">Manage Billing in Stripe</Button>
          </form>
        </CardContent>
      </Card>

      {/* Plan comparison */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Available Plans</h3>
        <div className="grid gap-4 md:grid-cols-4">
          {plans.map((p) => (
            <Card key={p.key} className={p.key === plan ? 'border-primary' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {p.name}
                  {p.key === plan && <Badge>Current</Badge>}
                </CardTitle>
                <CardDescription>
                  <span className="text-2xl font-bold text-foreground">{p.price}</span>/mo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium mb-2">{p.minutes}/month</p>
                <ul className="space-y-1">
                  {p.features.map((f) => (
                    <li key={f} className="text-sm text-muted-foreground">• {f}</li>
                  ))}
                </ul>
                <UpgradeButton plan={p.key} currentPlan={plan} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
