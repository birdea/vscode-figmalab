import * as vscode from 'vscode';
import { WebviewToHostMessage, HostToWebviewMessage, AgentType, LayerType } from '../types';
import { McpClient } from '../figma/McpClient';
import { parseMcpData } from '../figma/McpParser';
import { ScreenshotService } from '../figma/ScreenshotService';
import { AgentFactory } from '../agent/AgentFactory';
import { EditorIntegration } from '../editor/EditorIntegration';
import { Logger } from '../logger/Logger';
import { SECRET_KEYS } from '../constants';

export class WebviewMessageHandler {
  // Shared state across all handler instances (agent/model/mcpData)
  private static currentAgent: AgentType = 'gemini';
  private static currentModel: string = '';
  private static lastMcpData: unknown = null;

  private mcpClient: McpClient;
  private screenshotService: ScreenshotService;
  private editorIntegration: EditorIntegration;

  constructor(
    private webview: vscode.Webview,
    private context: vscode.ExtensionContext,
    mcpEndpoint: string
  ) {
    this.mcpClient = new McpClient(mcpEndpoint);
    this.screenshotService = new ScreenshotService(this.mcpClient);
    this.editorIntegration = new EditorIntegration();
  }

  private post(msg: HostToWebviewMessage) {
    this.webview.postMessage(msg);
  }

  async handle(msg: WebviewToHostMessage) {
    const source = this.getSourceFromCommand(msg.command);
    try {
      switch (msg.command) {
        case 'figma.connect':
          await this.handleFigmaConnect(msg.endpoint);
          break;
        case 'figma.fetchData':
          await this.handleFigmaFetch(msg.mcpData);
          break;
        case 'figma.screenshot':
          await this.handleScreenshot(msg.mcpData);
          break;
        case 'agent.getApiKeyHelp':
          await this.handleGetApiKeyHelp(msg.agent);
          break;
        case 'agent.getModelInfoHelp':
          await this.handleGetModelInfoHelp(msg.agent, msg.modelId);
          break;
        case 'agent.setApiKey':
          await this.handleSetApiKey(msg.agent, msg.key);
          break;
        case 'agent.listModels':
          await this.handleListModels(msg.agent);
          break;
        case 'state.setAgent':
          WebviewMessageHandler.currentAgent = msg.agent;
          WebviewMessageHandler.currentModel = '';
          break;
        case 'state.setModel':
          WebviewMessageHandler.currentModel = msg.model;
          break;
        case 'prompt.generate':
          await this.handleGenerate(msg.payload);
          break;
        case 'editor.open':
          await this.editorIntegration.openInEditor(msg.code, msg.language);
          break;
        case 'editor.saveFile':
          await this.editorIntegration.saveAsNewFile(msg.code, msg.filename);
          break;
      }
    } catch (e) {
      const err = e as Error;
      this.post({ event: 'error', source, message: err.message });
      Logger.error('system', err.message);
    }
  }

  private getSourceFromCommand(command: WebviewToHostMessage['command']): LayerType {
    if (command.startsWith('figma.')) return 'figma';
    if (command.startsWith('agent.') || command.startsWith('state.')) return 'agent';
    if (command.startsWith('prompt.') || command.startsWith('editor.')) return 'prompt';
    return 'system';
  }

  private async handleFigmaConnect(endpoint: string) {
    this.mcpClient.setEndpoint(endpoint);
    try {
      const connected = await this.mcpClient.initialize();
      const methods = connected ? await this.mcpClient.listTools() : [];
      this.post({ event: 'figma.status', connected, methods, error: connected ? undefined : 'Connection failed. Is the server running?' });
    } catch (e) {
      this.post({ event: 'figma.status', connected: false, methods: [], error: (e as Error).message });
    }
  }

  private async handleFigmaFetch(input: string) {
    const parsed = parseMcpData(input);
    WebviewMessageHandler.lastMcpData = parsed.raw;

    if (this.mcpClient.isConnected() && parsed.fileId) {
      try {
        const data = await this.mcpClient.callTool('get_file', { fileId: parsed.fileId, nodeId: parsed.nodeId });
        WebviewMessageHandler.lastMcpData = data;
        
        // Output to VSCode Editor
        try {
          const doc = await vscode.workspace.openTextDocument({
            language: 'json',
            content: JSON.stringify(data, null, 2)
          });
          await vscode.window.showTextDocument(doc, { preview: false });
        } catch (editorError) {
          Logger.error('editor', `Failed to open fetched data in editor: ${(editorError as Error).message}`);
        }

        this.post({ event: 'figma.dataResult', data });
      } catch {
        this.post({ event: 'figma.dataResult', data: parsed });
      }
    } else {
      this.post({ event: 'figma.dataResult', data: parsed });
    }
  }

  private async handleScreenshot(input: string) {
    const parsed = parseMcpData(input);
    if (!parsed.fileId) {
      this.post({ event: 'error', source: 'figma', message: 'Figma URL 또는 JSON에서 fileId를 찾을 수 없습니다.' });
      return;
    }
    try {
      const base64 = await this.screenshotService.fetchScreenshot(parsed.fileId, parsed.nodeId);
      
      // Output to VSCode Editor
      await this.screenshotService.openInEditor(base64, parsed.fileId);

      this.post({ event: 'figma.screenshotResult', base64 });
    } catch (e) {
      this.post({ event: 'error', source: 'figma', message: `Screenshot fetch failed: ${(e as Error).message}` });
    }
  }

  private async handleGetApiKeyHelp(agent: AgentType) {
    let url = '';
    if (agent === 'gemini') url = 'https://aistudio.google.com/app/apikey';
    else if (agent === 'claude') url = 'https://console.anthropic.com/settings/keys';
    else if (agent === 'codex') url = 'https://platform.openai.com/api-keys';

    if (url) {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }
  }

  private async handleGetModelInfoHelp(agent: AgentType, modelId: string) {
    try {
      const secretKey = SECRET_KEYS[`${agent.toUpperCase()}_API_KEY` as keyof typeof SECRET_KEYS];
      const key = await this.context.secrets.get(secretKey);
      if (key) {
        await AgentFactory.getAgent(agent).setApiKey(key);
      }
      
      const modelInfo = await AgentFactory.getAgent(agent).getModelInfo(modelId);
      
      const doc = await vscode.workspace.openTextDocument({
        language: 'json',
        content: JSON.stringify(modelInfo, null, 2)
      });
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch (e) {
      Logger.error('system', `Failed to open model info: ${(e as Error).message}`);
    }
  }

  private async handleSetApiKey(agent: AgentType, key: string) {
    const secretKey = SECRET_KEYS[`${agent.toUpperCase()}_API_KEY` as keyof typeof SECRET_KEYS];
    await this.context.secrets.store(secretKey, key);
    await AgentFactory.getAgent(agent).setApiKey(key);
    Logger.success('agent', `${agent} API key saved`);
  }

  private async handleListModels(agent: AgentType) {
    const secretKey = SECRET_KEYS[`${agent.toUpperCase()}_API_KEY` as keyof typeof SECRET_KEYS];
    const key = await this.context.secrets.get(secretKey);
    if (key) {
      await AgentFactory.getAgent(agent).setApiKey(key);
    }
    const models = await AgentFactory.getAgent(agent).listModels();
    this.post({ event: 'agent.modelsResult', models });
  }

  private async handleGenerate(payload: import('../types').PromptPayload) {
    const agent = payload.agent ?? WebviewMessageHandler.currentAgent;
    const model = payload.model ?? WebviewMessageHandler.currentModel;

    const secretKey = SECRET_KEYS[`${agent.toUpperCase()}_API_KEY` as keyof typeof SECRET_KEYS];
    const key = await this.context.secrets.get(secretKey);
    if (key) {
      await AgentFactory.getAgent(agent).setApiKey(key);
    }

    const resolvedPayload = {
      ...payload,
      agent,
      model,
      mcpData: payload.mcpData === undefined ? WebviewMessageHandler.lastMcpData : payload.mcpData,
    };

    Logger.info('prompt', `Generating ${resolvedPayload.outputFormat} code with ${agent}:${model}`);
    this.post({ event: 'prompt.generating', progress: 0 });

    try {
      let fullCode = '';
      let progress = 5;
      this.post({ event: 'prompt.generating', progress });
      const gen = AgentFactory.getAgent(agent).generateCode(resolvedPayload);
      for await (const chunk of gen) {
        fullCode += chunk;
        progress = Math.min(95, progress + 5);
        this.post({ event: 'prompt.generating', progress });
        this.post({ event: 'prompt.chunk', text: chunk });
      }

      this.post({ event: 'prompt.generating', progress: 100 });
      this.post({ event: 'prompt.result', code: fullCode, format: resolvedPayload.outputFormat });
    } catch (e) {
      const err = e as Error;
      this.post({ event: 'prompt.error', message: err.message });
      throw e;
    }
  }
}
