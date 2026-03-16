import {
  BedrockRuntimeClient,
  ConverseCommand,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { TranscriptEntry, Organization } from '@voiceagent/shared';
import { BEDROCK_MODEL_ID, MAX_TOKENS_RESPONSE, MAX_CONVERSATION_HISTORY, EMBEDDING_MODEL_ID, EMBEDDING_DIMENSIONS } from '@voiceagent/shared';
import { getToolDefinitions } from '../prompts/tools.js';

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

interface ConversationResponse {
  text: string | null;
  toolUse: { name: string; toolUseId: string; input: Record<string, unknown> } | null;
}

export class BedrockService {
  async converse(
    systemPrompt: string,
    history: TranscriptEntry[],
    org: Organization
  ): Promise<ConversationResponse> {
    const messages = history.slice(-MAX_CONVERSATION_HISTORY).map((entry) => ({
      role: entry.role === 'user' ? 'user' as const : 'assistant' as const,
      content: [{ text: entry.content }],
    }));

    const command = new ConverseCommand({
      modelId: BEDROCK_MODEL_ID,
      system: [{ text: systemPrompt }],
      messages,
      toolConfig: {
        tools: getToolDefinitions(org),
      },
      inferenceConfig: {
        maxTokens: MAX_TOKENS_RESPONSE,
        temperature: 0.7,
      },
    });

    const response = await client.send(command);
    return this.parseResponse(response);
  }

  async converseWithToolResult(
    systemPrompt: string,
    history: TranscriptEntry[],
    toolUse: { name: string; toolUseId: string; input: Record<string, unknown> },
    toolResult: string,
    org: Organization
  ): Promise<ConversationResponse> {
    const messages = history.slice(-MAX_CONVERSATION_HISTORY).map((entry) => ({
      role: entry.role === 'user' ? 'user' as const : 'assistant' as const,
      content: [{ text: entry.content }],
    }));

    // Add tool use and result
    messages.push({
      role: 'assistant',
      content: [{ toolUse: { toolUseId: toolUse.toolUseId, name: toolUse.name, input: toolUse.input } } as any],
    });
    messages.push({
      role: 'user',
      content: [{ toolResult: { toolUseId: toolUse.toolUseId, content: [{ text: toolResult }] } } as any],
    });

    const command = new ConverseCommand({
      modelId: BEDROCK_MODEL_ID,
      system: [{ text: systemPrompt }],
      messages,
      inferenceConfig: {
        maxTokens: MAX_TOKENS_RESPONSE,
        temperature: 0.7,
      },
    });

    const response = await client.send(command);
    return this.parseResponse(response);
  }

  async summarizeCall(history: TranscriptEntry[]): Promise<string> {
    const transcript = history.map((e) => `${e.role}: ${e.content}`).join('\n');

    const command = new ConverseCommand({
      modelId: BEDROCK_MODEL_ID,
      system: [{ text: 'Summarize this phone call in 1-2 sentences. Focus on the key outcome.' }],
      messages: [{ role: 'user', content: [{ text: transcript }] }],
      inferenceConfig: { maxTokens: 150 },
    });

    const response = await client.send(command);
    return this.parseResponse(response).text || 'Call completed.';
  }

  async analyzeCall(history: TranscriptEntry[]): Promise<{
    sentiment: string;
    intent: string;
    leadScore: number;
    callerName: string | null;
  }> {
    const transcript = history.map((e) => `${e.role}: ${e.content}`).join('\n');

    const command = new ConverseCommand({
      modelId: BEDROCK_MODEL_ID,
      system: [{
        text: `Analyze this call transcript. Return JSON with:
- sentiment: "positive", "neutral", "negative", or "urgent"
- intent: primary intent (e.g. "booking", "inquiry", "complaint", "order")
- leadScore: 1-100 based on conversion likelihood
- callerName: extracted caller name or null
Return only valid JSON, no other text.`
      }],
      messages: [{ role: 'user', content: [{ text: transcript }] }],
      inferenceConfig: { maxTokens: 200 },
    });

    const response = await client.send(command);
    const text = this.parseResponse(response).text || '{}';

    try {
      return JSON.parse(text);
    } catch {
      return { sentiment: 'neutral', intent: 'unknown', leadScore: 50, callerName: null };
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const command = new InvokeModelCommand({
      modelId: EMBEDDING_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        inputText: text,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    const response = await client.send(command);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    return body.embedding;
  }

  private parseResponse(response: any): ConversationResponse {
    const output = response.output;
    let text: string | null = null;
    let toolUse: ConversationResponse['toolUse'] = null;

    if (output?.message?.content) {
      for (const block of output.message.content) {
        if (block.text) {
          text = block.text;
        }
        if (block.toolUse) {
          toolUse = {
            name: block.toolUse.name,
            toolUseId: block.toolUse.toolUseId,
            input: block.toolUse.input,
          };
        }
      }
    }

    return { text, toolUse };
  }
}
