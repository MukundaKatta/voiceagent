'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';

const STATUSES = ['all', 'completed', 'missed', 'transferred', 'in_progress', 'failed'];
const SENTIMENTS = ['all', 'positive', 'neutral', 'negative', 'urgent'];

export function CallFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all' || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/calls?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Input
        placeholder="Search calls..."
        className="max-w-xs"
        defaultValue={searchParams.get('q') || ''}
        onChange={(e) => {
          const timeout = setTimeout(() => updateFilter('q', e.target.value), 500);
          return () => clearTimeout(timeout);
        }}
      />
      <select
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={searchParams.get('status') || 'all'}
        onChange={(e) => updateFilter('status', e.target.value)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>
        ))}
      </select>
      <select
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={searchParams.get('sentiment') || 'all'}
        onChange={(e) => updateFilter('sentiment', e.target.value)}
      >
        {SENTIMENTS.map((s) => (
          <option key={s} value={s}>{s === 'all' ? 'All sentiments' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
        ))}
      </select>
    </div>
  );
}
