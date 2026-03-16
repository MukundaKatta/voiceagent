'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export function KnowledgeActions({ id }: { id: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm('Delete this entry?')) return;

    const supabase = createClient();
    await supabase
      .from('knowledge_base')
      .update({ active: false })
      .eq('id', id);

    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDelete} className="ml-2 text-muted-foreground hover:text-destructive">
      Delete
    </Button>
  );
}
