import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function KnowledgePage() {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Knowledge Base</h2>
      </div>
      <div className="space-y-2">
        {items?.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{item.title}</p>
                {item.category && <Badge variant="secondary">{item.category}</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.content}</p>
            </CardContent>
          </Card>
        )) || <p className="text-muted-foreground">No knowledge base entries yet.</p>}
      </div>
    </div>
  );
}
