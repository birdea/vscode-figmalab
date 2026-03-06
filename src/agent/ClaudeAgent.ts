import Anthropic from '@anthropic-ai/sdk';
import { AgentType, ModelInfo, PromptPayload } from '../types';
import { BaseAgent } from './BaseAgent';
import { Logger } from '../logger/Logger';

const CLAUDE_MODELS: ModelInfo[] = [
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    description: 'Most capable Claude',
    inputTokenLimit: 200000,
    outputTokenLimit: 8192,
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: 'Latest Claude Sonnet',
    inputTokenLimit: 200000,
    outputTokenLimit: 8192,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: 'Fast and efficient',
    inputTokenLimit: 200000,
    outputTokenLimit: 8192,
  },
];

export class ClaudeAgent extends BaseAgent {
  readonly type: AgentType = 'claude';
  private client: Anthropic | null = null;

  async setApiKey(key: string): Promise<void> {
    await super.setApiKey(key);
    this.client = new Anthropic({ apiKey: key });
    Logger.info('agent', 'Claude API key updated');
  }

  async listModels(): Promise<ModelInfo[]> {
    return CLAUDE_MODELS;
  }

  async getModelInfo(modelId: string): Promise<ModelInfo> {
    return CLAUDE_MODELS.find((m) => m.id === modelId) ?? { id: modelId, name: modelId };
  }

  async *generateCode(payload: PromptPayload): AsyncGenerator<string> {
    this.ensureApiKey();
    if (!this.client) {
      throw new Error('Claude client not initialized');
    }

    const prompt = this.buildPrompt(payload);
    Logger.info('agent', `Generating with Claude: ${payload.model}`);

    try {
      const stream = this.client.messages.stream({
        model: payload.model || 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: `You are an expert UI developer. Generate ${payload.outputFormat} code that faithfully reproduces the Figma design. Output ONLY valid code. No explanation.`,
        messages: [{ role: 'user', content: prompt }],
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
      Logger.success('agent', 'Claude code generation complete');
    } catch (e) {
      Logger.error('agent', `Claude generation failed: ${(e as Error).message}`);
      throw e;
    }
  }

  private buildPrompt(payload: PromptPayload): string {
    const lines: string[] = [];

    if (payload.userPrompt) {
      lines.push('User instruction:', payload.userPrompt, '');
    }

    if (payload.mcpData) {
      lines.push('Figma MCP data:', JSON.stringify(payload.mcpData, null, 2), '');
    }

    lines.push(`Output format: ${payload.outputFormat}`);
    return lines.join('\n');
  }
}
