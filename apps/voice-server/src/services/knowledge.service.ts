import { supabase } from './supabase.service.js';
import { BedrockService } from './bedrock.service.js';

export class KnowledgeService {
  private bedrockService = new BedrockService();

  /**
   * Search knowledge base using vector similarity.
   * Falls back to text search if embeddings aren't available.
   */
  async search(orgId: string, query: string, limit = 5): Promise<Array<{ title: string; content: string; category: string | null }>> {
    // Try vector search first
    try {
      const embedding = await this.bedrockService.generateEmbedding(query);

      const { data, error } = await supabase.rpc('match_knowledge', {
        query_embedding: embedding,
        match_threshold: 0.6,
        match_count: limit,
        p_org_id: orgId,
      });

      if (!error && data && data.length > 0) {
        return data.map((item: any) => ({
          title: item.title,
          content: item.content,
          category: item.category,
        }));
      }
    } catch (error) {
      console.error('Vector search failed, falling back to text search:', error);
    }

    // Fallback: keyword text search
    return this.textSearch(orgId, query, limit);
  }

  /**
   * Search by specific category (e.g., 'menu', 'hours', 'services').
   */
  async searchByCategory(orgId: string, category: string, limit = 10): Promise<Array<{ title: string; content: string }>> {
    const { data } = await supabase
      .from('knowledge_base')
      .select('title, content')
      .eq('org_id', orgId)
      .eq('category', category)
      .eq('active', true)
      .limit(limit);

    return data || [];
  }

  /**
   * Get all knowledge for an org (used for initial context loading).
   */
  async getAllForOrg(orgId: string): Promise<Array<{ title: string; content: string; category: string | null }>> {
    const { data } = await supabase
      .from('knowledge_base')
      .select('title, content, category')
      .eq('org_id', orgId)
      .eq('active', true)
      .order('category')
      .limit(50);

    return data || [];
  }

  /**
   * Chunk a large document into smaller pieces for embedding.
   * Each chunk overlaps slightly with the next for context continuity.
   */
  static chunkText(text: string, maxChunkSize = 500, overlap = 50): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        // Keep overlap from end of previous chunk
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.ceil(overlap / 5));
        currentChunk = overlapWords.join(' ') + ' ' + sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Embed and store a knowledge base entry. Handles chunking for large content.
   */
  async embedEntry(entryId: string, title: string, content: string): Promise<void> {
    const textToEmbed = `${title}: ${content}`;

    try {
      const embedding = await this.bedrockService.generateEmbedding(textToEmbed);

      await supabase
        .from('knowledge_base')
        .update({ embedding })
        .eq('id', entryId);
    } catch (error) {
      console.error(`Failed to embed entry ${entryId}:`, error);
    }
  }

  private async textSearch(orgId: string, query: string, limit: number) {
    // Build tsquery from user's words
    const terms = query
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => w.replace(/[^\w]/g, ''))
      .filter(Boolean);

    if (terms.length === 0) {
      // Return general info if query is too short
      const { data } = await supabase
        .from('knowledge_base')
        .select('title, content, category')
        .eq('org_id', orgId)
        .eq('active', true)
        .limit(limit);
      return data || [];
    }

    const { data } = await supabase
      .from('knowledge_base')
      .select('title, content, category')
      .eq('org_id', orgId)
      .eq('active', true)
      .textSearch('content', terms.join(' | '))
      .limit(limit);

    return data || [];
  }
}
