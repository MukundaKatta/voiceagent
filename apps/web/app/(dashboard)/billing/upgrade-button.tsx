'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function UpgradeButton({ plan, currentPlan }: { plan: string; currentPlan: string }) {
  const [loading, setLoading] = useState(false);

  if (plan === currentPlan) return null;

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" className="mt-3 w-full" onClick={handleUpgrade} disabled={loading}>
      {loading ? 'Redirecting...' : 'Upgrade'}
    </Button>
  );
}
