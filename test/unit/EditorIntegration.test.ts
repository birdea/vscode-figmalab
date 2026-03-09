import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { EditorIntegration } from '../../src/editor/EditorIntegration';

suite('EditorIntegration', () => {
  let integration: EditorIntegration;

  setup(() => {
    integration = new EditorIntegration();
  });

  test('openInEditor calls workspace.openTextDocument', async () => {
    const vscode = require('vscode');
    const editStub = sinon.stub().callsFake(async (callback: any) => {
      const builder = { insert: sinon.stub() };
      callback(builder);
      return true;
    });
    vscode.workspace.openTextDocument.resolves({ languageId: 'plaintext' });
    vscode.window.showTextDocument.resolves({ edit: editStub });

    await integration.openInEditor('const x = 1;', 'javascript', 'generated.ts');
    assert.ok(
      vscode.workspace.openTextDocument.calledWithMatch(sinon.match.has('scheme', 'untitled')),
    );
    assert.ok(vscode.languages.setTextDocumentLanguage.calledOnce);
    assert.ok(vscode.window.showTextDocument.calledOnce);
    assert.ok(editStub.calledOnce);
    assert.ok(vscode.commands.executeCommand.calledWith('editor.action.formatDocument'));
  });

  test('openInEditor enables word wrap when editor setting is off', async () => {
    const vscode = require('vscode');
    const editStub = sinon.stub().resolves(true);
    const getStub = sinon.stub().withArgs('wordWrap').returns('off');
    vscode.workspace.openTextDocument.resolves({ languageId: 'json' });
    vscode.workspace.getConfiguration.returns({ get: getStub });
    vscode.window.showTextDocument.resolves({ edit: editStub });

    await integration.openInEditor('{"a":1}', 'json', 'data.json');

    assert.ok(vscode.commands.executeCommand.calledWith('editor.action.toggleWordWrap'));
  });

  test('saveAsNewFile calls showInformationMessage', async () => {
    const vscode = require('vscode');
    const saveDialogStub = vscode.window.showSaveDialog;
    vscode.window.showSaveDialog.resolves({ fsPath: '/test/path.ts' });

    await integration.saveAsNewFile('code', 'test.ts');
    const saveArgs = saveDialogStub.firstCall.args[0];
    if (saveArgs.defaultUri?.fsPath) {
      assert.strictEqual(
        saveArgs.defaultUri.fsPath,
        path.join(os.homedir(), 'Documents', 'test.ts'),
      );
    }
    assert.ok(vscode.window.showInformationMessage.called);
  });

  test('saveAsNewFile cancelled by user does not write file', async () => {
    const vscode = require('vscode');
    vscode.window.showSaveDialog.resolves(undefined);
    vscode.workspace.fs.writeFile.resetHistory();

    await integration.saveAsNewFile('code', 'test.ts');
    assert.ok(!vscode.workspace.fs.writeFile.called);
  });
});
