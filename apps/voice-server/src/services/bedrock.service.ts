import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { TranscriptEntry, Organization } from '@voiceagent/shared';
import { BEDROCK_MODEL_ID, MAX_TOKENS_RESPONSE, MAX_CONVERSATION_HISTORY, EMBEDDING_MODEL_ID, EMBEDDING_DIMENSIONS } from '@voiceagent/shared';
import { getToolDefinitions } from '../prompts/tools.js';

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

export interface ConversationResponse {
  text: string | null;
  toolUse: { name: string; toolUseId: string; input: Record<string, unknown> } | null;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onToolUse: (toolUse: { name: string; toolUseId: string; input: Record<string, unknown> }) => void;
  onError: (error: Error) => void;
}

function buildMessages(history: TranscriptEntry[]) {
  return history.slice(-MAX_CONVERSATION_HISTORY).map((entry) => ({
    role: entry.role === 'user' ? 'user' as const : 'assistant' as const,
    content: [{ text: entry.content }],
  }));
}

export class BedrockService {
  /**
   * Stream responses token-by-token for low-latency voice output.
   * Returns an AbortController so the caller can cancel on interrupt.
   */
  async converseStream(
    systemPrompt: string,
    history: TranscriptEntry[],
    org: Organization,
    callbacks: StreamCallbacks
  ): Promise<AbortController> {
    const abortController = new AbortController();
    const messages = buildMessages(history);

    const command = new ConverseStreamCommand({
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

    // Run streaming in background
    (async () => {
      try {
        const response = await client.send(command, {
          abortSignal: abortController.signal,
        });

        let fullText = '';
        let toolUseId = '';
        let toolName = '';
        let toolInputJson = '';
        let isToolUse = false;

        if (response.stream) {
          for await (const event of response.stream) {
            if (abortController.signal.aborted) break;

            if (event.contentBlockStart) {
              const start = event.contentBlockStart.start;
              if (start?.toolUse) {
                isToolUse = true;
                toolUseId = start.toolUse.toolUseId || '';
                toolName = start.toolUse.name || '';
                toolInputJson = '';
              }
            }

            if (event.contentBlockDelta) {
              const delta = event.contentBlockDelta.delta;
              if (delta?.text && !isToolUse) {
                fullText += delta.text;
                callbacks.onToken(delta.text);
              }
              if (delta?.toolUse) {
                toolInputJson += delta.toolUse.input || '';
              }
            }

            if (event.contentBlockStop) {
              if (isToolUse) {
                try {
                  const input = JSON.parse(toolInputJson || '{}');
                  callbacks.onToolUse({ name: toolName, toolUseId, input });
                } catch {
                  callbacks.onError(new Error(`Failed to parse tool input: ${toolInputJson}`));
                }
                isToolUse = false;
              }
            }

            if (event.messageStop) {
              if (fullText) {
                callbacks.onComplete(fullText);
              }
            }
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError' || abortController.signal.aborted) {
          return; // Expected on interrupt
        }
        callbacks.onError(error);
      }
    })();

    return abortController;
  }

  /**
   * Non-streaming converse — used for tool result follow-ups where we need
   * the complete response before sending to the caller.
   */
  async converse(
    systemPrompt: string,
    history: TranscriptEntry[],
    org: Organization
  ): Promise<ConversationResponse> {
    const messages = buildMessages(history);

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
    const messages = buildMessages(history);

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
