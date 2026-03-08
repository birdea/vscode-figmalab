import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';

// Setup Mock Environment for Browser
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost',
});
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).document.documentElement.lang = 'ko';
(global as any).document.body.dataset.locale = 'ko';
(global as any).navigator = dom.window.navigator;
(global as any).Node = dom.window.Node;
(global as any).HTMLElement = dom.window.HTMLElement;
(global as any).HTMLSelectElement = dom.window.HTMLSelectElement;
(global as any).HTMLInputElement = dom.window.HTMLInputElement;
(global as any).HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
// Provide synchronous requestAnimationFrame polyfill for jsdom tests
(global as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
  cb(0);
  return 0;
};
(dom.window as any).requestAnimationFrame = (global as any).requestAnimationFrame;

(global as any).acquireVsCodeApi = () => ({
  postMessage: () => {},
  getState: () => ({}),
  setState: () => {},
});
(dom.window as any).acquireVsCodeApi = (global as any).acquireVsCodeApi;

// Mock vscode module for Node
const mockVscode = {
  window: {
    showInformationMessage: sinon.stub(),
    showErrorMessage: sinon.stub(),
    showTextDocument: sinon.stub(),
    createWebviewPanel: sinon.stub(),
    showSaveDialog: sinon.stub(),
    createOutputChannel: sinon.stub(),
    registerWebviewViewProvider: sinon.stub(),
  },
  workspace: {
    getConfiguration: sinon.stub().returns({
      get: sinon.stub(),
    }),
    onDidChangeConfiguration: sinon.stub().returns({ dispose: sinon.stub() }),
    openTextDocument: sinon.stub(),
    workspaceFolders: undefined,
    fs: {
      writeFile: sinon.stub(),
      delete: sinon.stub(),
    },
  },
  Uri: {
    parse: sinon.stub().returns({}),
    file: sinon.stub().returns({}),
    joinPath: sinon.stub().returns({}),
  },
  commands: {
    registerCommand: sinon.stub().returns({ dispose: sinon.stub() }),
    executeCommand: sinon.stub().returns({}),
  },
  env: {
    language: 'ko',
    clipboard: {
      writeText: sinon.stub().resolves(),
    },
    openExternal: sinon.stub(),
  },
  ViewColumn: {
    One: 1,
    Two: 2,
  },
  EventEmitter: class {
    event = sinon.stub();
    fire = sinon.stub();
  }
};

// Intercept require('vscode') for tests
const m = require('module');
const originalRequire = m.prototype.require;
m.prototype.require = function(path: string) {
  if (path === 'vscode') return mockVscode;
  // @anthropic-ai/sdk >=0.78 detects jsdom's global `window` as a browser
  // environment and throws at construction time. Since this process is Node
  // (a VSCode extension), patch the cached module so that new Anthropic(...)
  // automatically sets dangerouslyAllowBrowser:true in tests.
  if (path === '@anthropic-ai/sdk') {
    const realSdk = originalRequire.apply(this, arguments);
    const OriginalAnthropic: new (...args: any[]) => any = realSdk.default;
    if (!OriginalAnthropic.__testPatched) {
      class PatchedAnthropic extends OriginalAnthropic {
        constructor(opts: Record<string, unknown> = {}) {
          super({ dangerouslyAllowBrowser: true, ...opts });
        }
        static __testPatched = true;
      }
      Object.defineProperty(realSdk, 'default', { value: PatchedAnthropic, writable: true, configurable: true });
      realSdk.Anthropic = PatchedAnthropic;
    }
    return realSdk;
  }
  return originalRequire.apply(this, arguments);
};
