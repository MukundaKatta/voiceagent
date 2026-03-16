'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VERTICALS } from '@voiceagent/shared';

export function OnboardingForm() {
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [vertical, setVertical] = useState('general');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    // Create organization
    const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: businessName,
        slug,
        vertical,
        timezone,
      })
      .select()
      .single();

    if (orgError) {
      setError(orgError.message);
      setLoading(false);
      return;
    }

    // Link user to org
    await supabase
      .from('users')
      .update({ org_id: org.id })
      .eq('auth_uid', user.id);

    setLoading(false);
    router.push('/overview');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Business Name</label>
            <Input
              className="mt-1"
              placeholder="e.g., Amogha Cafe"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
            />
          </div>
          <Button
            type="button"
            className="w-full"
            onClick={() => setStep(2)}
            disabled={!businessName}
          >
            Next
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Business Type</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {VERTICALS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`rounded-lg border p-3 text-sm text-left transition-colors ${
                    vertical === v ? 'border-primary bg-primary/5 font-medium' : 'hover:bg-accent'
                  }`}
                  onClick={() => setVertical(v)}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1).replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Timezone</label>
            <Input
              className="mt-1"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Creating...' : 'Create Business'}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
