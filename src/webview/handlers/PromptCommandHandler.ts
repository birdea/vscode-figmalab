import * as vscode from 'vscode';
import { AgentFactory } from '../../agent/AgentFactory';
import { EditorIntegration } from '../../editor/EditorIntegration';
import { Logger } from '../../logger/Logger';
import { PromptBuilder } from '../../prompt/PromptBuilder';
import { PromptPayload, HostToWebviewMessage } from '../../types';
import { SECRET_KEYS } from '../../constants';
import { StateManager } from '../../state/StateManager';
import { UiLocale, USER_CANCELLED_CODE_GENERATION, t } from '../../i18n';

export class PromptCommandHandler {
  private isGenerating = false;
  private currentRequestId: string | null = null;
  private abortController: AbortController | null = null;

  constructor(
    private webview: vscode.Webview,
    private context: vscode.ExtensionContext,
    private editorIntegration: EditorIntegration,
    private stateManager: StateManager,
    private locale: UiLocale,
  ) {}

  private post(msg: HostToWebviewMessage) {
    this.webview.postMessage(msg);
  }

  async generate(payload: PromptPayload) {
    if (this.isGenerating) {
      this.post({
        event: 'prompt.error',
        message: t(this.locale, 'host.prompt.alreadyGenerating'),
        code: 'failed',
      });
      return;
    }

    const agent = payload.agent ?? this.stateManager.getAgent();
    const model = payload.model ?? this.stateManager.getModel();

    const secretKey = SECRET_KEYS[`${agent.toUpperCase()}_API_KEY` as keyof typeof SECRET_KEYS];
    const key = await this.context.secrets.get(secretKey);
    if (key) {
      await AgentFactory.getAgent(agent).setApiKey(key);
    }

    const resolvedPayload = {
      ...payload,
      agent,
      model,
      mcpData: payload.mcpData === undefined ? this.stateManager.getLastMcpData() : payload.mcpData,
    };

    Logger.info('prompt', `Generating ${resolvedPayload.outputFormat} code with ${agent}:${model}`);
    this.post({ event: 'prompt.generating', progress: 0 });
    this.isGenerating = true;
    this.currentRequestId = payload.requestId ?? null;
    this.abortController = new AbortController();

    try {
      let fullCode = '';
      let progress = 5;
      this.post({ event: 'prompt.generating', progress });
      const gen = AgentFactory.getAgent(agent).generateCode(
        resolvedPayload,
        this.abortController.signal,
      );
      for await (const chunk of gen) {
        if (this.abortController.signal.aborted) {
          throw new Error(USER_CANCELLED_CODE_GENERATION);
        }
        fullCode += chunk;
        progress = Math.min(95, progress + 5);
        this.post({ event: 'prompt.generating', progress });
        this.post({ event: 'prompt.chunk', text: chunk });
      }

      this.post({ event: 'prompt.generating', progress: 100 });
      this.post({ event: 'prompt.result', code: fullCode, format: resolvedPayload.outputFormat });
    } catch (e) {
      const err = e as Error;
      const isCancelled =
        this.abortController?.signal.aborted || err.message === USER_CANCELLED_CODE_GENERATION;
      this.post({
        event: 'prompt.error',
        message: isCancelled ? t(this.locale, 'host.prompt.cancelled') : err.message,
        code: isCancelled ? 'cancelled' : 'failed',
      });
    } finally {
      this.isGenerating = false;
      this.currentRequestId = null;
      this.abortController = null;
    }
  }

  cancel(requestId?: string) {
    if (!this.isGenerating || !this.abortController) {
      return;
    }
    if (requestId && this.currentRequestId && requestId !== this.currentRequestId) {
      return;
    }

    Logger.info('prompt', 'Code generation cancelled by user');
    this.abortController.abort();
  }

  estimate(payload: PromptPayload) {
    const builder = new PromptBuilder();
    const resolvedPayload = {
      ...payload,
      mcpData: payload.mcpData === undefined ? this.stateManager.getLastMcpData() : payload.mcpData,
    };
    const estimate = builder.estimate(resolvedPayload);
    this.post({ event: 'prompt.estimateResult', tokens: estimate.tokens, kb: estimate.kb });
  }

  async openEditor(code: string, language?: string) {
    await this.editorIntegration.openInEditor(code, language);
  }

  async saveFile(code: string, filename: string) {
    await this.editorIntegration.saveAsNewFile(code, filename);
  }

  getGeneratingState() {
    return this.isGenerating;
  }
}
