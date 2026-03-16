import { supabase } from './supabase.service.js';
import { BedrockService } from './bedrock.service.js';

export class KnowledgeService {
  private bedrockService = new BedrockService();

  async search(orgId: string, query: string, limit = 5): Promise<Array<{ title: string; content: string }>> {
    try {
      const embedding = await this.bedrockService.generateEmbedding(query);

      const { data, error } = await supabase.rpc('match_knowledge', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: limit,
        p_org_id: orgId,
      });

      if (error) {
        console.error('Knowledge search error:', error);
        return [];
      }

      return data?.map((item: any) => ({
        title: item.title,
        content: item.content,
      })) || [];
    } catch (error) {
      console.error('Knowledge search failed:', error);
      // Fallback: simple text search
      const { data } = await supabase
        .from('knowledge_base')
        .select('title, content')
        .eq('org_id', orgId)
        .eq('active', true)
        .textSearch('content', query.split(' ').join(' | '))
        .limit(limit);

      return data || [];
    }
  }
}
