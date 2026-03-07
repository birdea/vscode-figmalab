import * as vscode from 'vscode';
import { SidebarProvider } from './webview/SidebarProvider';
import { Logger } from './logger/Logger';
import { AgentFactory } from './agent/AgentFactory';
import { COMMANDS, VIEW_IDS, SECRET_KEYS } from './constants';
import { AgentType } from './types';
import { StateManager } from './state/StateManager';

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('Figma MCP Helper');
  Logger.initialize(outputChannel);
  const stateManager = new StateManager();

  // Load saved API keys at activation
  const agents: AgentType[] = ['gemini', 'claude'];
  for (const agent of agents) {
    const secretKey = SECRET_KEYS[`${agent.toUpperCase()}_API_KEY` as keyof typeof SECRET_KEYS];
    const key = await context.secrets.get(secretKey);
    if (key) {
      await AgentFactory.getAgent(agent).setApiKey(key);
    }
  }

  const setupProvider = new SidebarProvider(
    VIEW_IDS.SETUP,
    'setup',
    context.extensionUri,
    context,
    stateManager,
  );
  const promptProvider = new SidebarProvider(
    VIEW_IDS.PROMPT,
    'prompt',
    context.extensionUri,
    context,
    stateManager,
  );
  const logProvider = new SidebarProvider(
    VIEW_IDS.LOG,
    'log',
    context.extensionUri,
    context,
    stateManager,
    (entry) => logProvider.postMessage({ event: 'log.append', entry }),
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_IDS.SETUP, setupProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.registerWebviewViewProvider(VIEW_IDS.PROMPT, promptProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.registerWebviewViewProvider(VIEW_IDS.LOG, logProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.CONNECT, async () => {
      await vscode.commands.executeCommand('workbench.view.extension.figma-mcp-helper');
      setupProvider.postMessage({ event: 'figma.connectRequested' });
    }),
    vscode.commands.registerCommand(COMMANDS.GENERATE, () => {
      vscode.commands.executeCommand('workbench.view.extension.figma-mcp-helper');
    }),
    vscode.commands.registerCommand('figma-mcp-helper.prompt.generate', () => {
      promptProvider.postMessage({ event: 'prompt.generateRequested' });
    }),
    vscode.commands.registerCommand('figma-mcp-helper.log.clear', () => {
      Logger.clear();
      logProvider.postMessage({ event: 'log.clear' });
    }),
    vscode.commands.registerCommand('figma-mcp-helper.log.copy', async () => {
      await vscode.env.clipboard.writeText(Logger.toText());
      vscode.window.showInformationMessage('Log copied to clipboard');
    }),
    vscode.commands.registerCommand('figma-mcp-helper.log.save', async () => {
      const uri = await vscode.window.showSaveDialog({
        filters: { JSON: ['json'], Text: ['txt'] },
        saveLabel: 'Save Log',
      });
      if (uri) {
        const content = uri.fsPath.endsWith('.json') ? Logger.toJson() : Logger.toText();
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
        vscode.window.showInformationMessage(`Log saved: ${uri.fsPath}`);
      }
    }),
    outputChannel,
  );

  Logger.info('system', `Figma MCP Helper v${context.extension.packageJSON.version} activated`);
}

export function deactivate() {
  Logger.info('system', 'Figma MCP Helper deactivated');
  AgentFactory.clear();
  Logger.clear();
}
