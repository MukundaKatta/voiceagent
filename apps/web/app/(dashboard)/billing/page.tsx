import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Billing</h2>
      <Card>
        <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Manage your subscription and billing details through Stripe.</p>
          <form action="/api/billing/portal" method="POST">
            <Button type="submit">Manage Billing</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
