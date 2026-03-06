import { GoogleGenerativeAI } from '@google/generative-ai';
import { AgentType, ModelInfo, PromptPayload } from '../types';
import { BaseAgent } from './BaseAgent';
import { Logger } from '../logger/Logger';
import * as https from 'https';

export class GeminiAgent extends BaseAgent {
  readonly type: AgentType = 'gemini';
  private client: GoogleGenerativeAI | null = null;

  async setApiKey(key: string): Promise<void> {
    await super.setApiKey(key);
    this.client = new GoogleGenerativeAI(key);
    Logger.info('agent', 'Gemini API key updated');
  }

  async listModels(): Promise<ModelInfo[]> {
    this.ensureApiKey();
    return new Promise((resolve, reject) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data) as {
                models?: Array<{
                  name: string;
                  displayName: string;
                  description: string;
                  inputTokenLimit: number;
                  outputTokenLimit: number;
                }>;
              };
              const models: ModelInfo[] = (json.models || [])
                .filter((m) => m.name.includes('gemini'))
                .map((m) => ({
                  id: m.name.replace('models/', ''),
                  name: m.displayName || m.name,
                  description: m.description,
                  inputTokenLimit: m.inputTokenLimit,
                  outputTokenLimit: m.outputTokenLimit,
                }))
                .sort((a, b) => b.id.localeCompare(a.id)); // sort descending by id (e.g., gemini-2.0 > gemini-1.5)

              Logger.info('agent', `Gemini models loaded: ${models.length}`);
              resolve(models);
            } catch {
              reject(new Error(`Failed to parse models response: ${data}`));
            }
          });
        })
        .on('error', (e) => {
          Logger.error('agent', `Failed to list Gemini models: ${e.message}`);
          reject(e);
        });
    });
  }

  async getModelInfo(modelId: string): Promise<ModelInfo> {
    const models = await this.listModels();
    const found = models.find((m) => m.id === modelId || m.id.includes(modelId));
    if (!found) {
      return { id: modelId, name: modelId };
    }
    return found;
  }

  async *generateCode(payload: PromptPayload): AsyncGenerator<string> {
    this.ensureApiKey();
    if (!this.client) {
      throw new Error('Gemini client not initialized');
    }

    const model = this.client.getGenerativeModel({ model: payload.model || 'gemini-2.0-flash' });
    const prompt = this.buildPrompt(payload);

    Logger.info('agent', `Generating with Gemini: ${payload.model}`);

    try {
      const result = await model.generateContentStream(prompt);
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }
      Logger.success('agent', 'Gemini code generation complete');
    } catch (e) {
      Logger.error('agent', `Gemini generation failed: ${(e as Error).message}`);
      throw e;
    }
  }

  private buildPrompt(payload: PromptPayload): string {
    const lines: string[] = [
      `You are an expert UI developer. Based on the provided Figma design data, generate ${payload.outputFormat} code that faithfully reproduces the layout.`,
      'Output ONLY valid code. No explanation.',
      '',
    ];

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
