'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export function AppointmentActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();

  async function updateStatus(newStatus: string) {
    const supabase = createClient();
    await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
    router.refresh();
  }

  if (status !== 'confirmed') return null;

  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" onClick={() => updateStatus('completed')}>
        Complete
      </Button>
      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => updateStatus('cancelled')}>
        Cancel
      </Button>
      <Button size="sm" variant="ghost" onClick={() => updateStatus('no_show')}>
        No Show
      </Button>
    </div>
  );
}
