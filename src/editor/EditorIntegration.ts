import * as vscode from 'vscode';
import { Logger } from '../logger/Logger';

export class EditorIntegration {
  async insertAtCursor(code: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor. Please open a file first.');
      Logger.warn('editor', 'Insert failed: no active editor');
      return;
    }

    await editor.edit((editBuilder) => {
      const position = editor.selection.active;
      editBuilder.insert(position, code);
    });

    Logger.success('editor', `Code inserted at cursor (${code.length} chars)`);
  }

  async saveAsNewFile(code: string, defaultName: string = 'generated'): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const defaultUri = workspaceFolders
      ? vscode.Uri.joinPath(workspaceFolders[0].uri, defaultName)
      : undefined;

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: {
        'All Files': ['*'],
        TypeScript: ['ts', 'tsx'],
        HTML: ['html'],
        SCSS: ['scss'],
        Kotlin: ['kt'],
      },
      saveLabel: 'Save Generated Code',
    });

    if (!saveUri) {
      Logger.info('editor', 'Save cancelled by user');
      return;
    }

    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(saveUri, encoder.encode(code));
    await vscode.window.showTextDocument(saveUri);
    Logger.success('editor', `Code saved: ${saveUri.fsPath}`);
    vscode.window.showInformationMessage(`Saved: ${saveUri.fsPath}`);
  }
}
