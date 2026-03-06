import { vscode } from '../vscodeApi';

export class FigmaLayer {
  private connected = false;

  render(): string {
    return `
<div class="panel">
  <div class="panel-title">MCP Connection</div>
  <div class="status-row" id="figma-status-row">
    <span class="status-dot" id="figma-status-dot"></span>
    <span id="figma-status-text" class="status-text">연결되지 않음</span>
  </div>
  <div class="row" style="margin-top: 8px;">
    <input type="text" id="mcp-endpoint" value="http://localhost:3845" placeholder="MCP Endpoint (예: http://localhost:3845)" />
    <button class="primary" id="btn-connect"><i class="codicon codicon-plug"></i>Connect</button>
  </div>
  <div class="description-text" style="margin-top: 6px;">Figma MCP 서버를 수동 연결하면 데이터 조회와 스크린샷 기능이 활성화됩니다.</div>
</div>
<div class="panel">
  <div class="panel-title">Figma Source</div>
  <div class="field-group">
    <label for="mcp-data">MCP 데이터 입력 (URL 또는 JSON)</label>
    <textarea id="mcp-data" placeholder="https://figma.com/file/... 또는 JSON"></textarea>
  </div>
  <div class="btn-row" style="margin-top: 8px;">
    <button class="secondary" id="btn-fetch"><i class="codicon codicon-cloud-download"></i>Fetch Data</button>
    <button class="primary" id="btn-screenshot"><i class="codicon codicon-device-camera"></i>Capture Screenshot</button>
  </div>
  <div class="notice hidden" id="figma-notice" style="margin-top: 8px;"></div>
  <pre class="code-output" id="figma-data-preview"></pre>
  <img class="screenshot-preview" id="figma-screenshot-preview" alt="Figma screenshot preview" />
</div>
`;
  }

  mount() {
    const endpointInput = document.getElementById('mcp-endpoint') as HTMLInputElement | null;
    const dataInput = document.getElementById('mcp-data') as HTMLTextAreaElement | null;

    dataInput?.addEventListener('input', () => this.updateActionState());

    document.getElementById('btn-connect')?.addEventListener('click', () => {
      const endpoint = endpointInput?.value.trim() ?? '';
      if (!endpoint) {
        this.setNotice('warn', 'MCP Endpoint를 입력하세요.');
        return;
      }
      this.setNotice('info', 'MCP 서버 연결을 시도하고 있습니다...');
      vscode.postMessage({ command: 'figma.connect', endpoint });
    });

    document.getElementById('btn-fetch')?.addEventListener('click', () => {
      const mcpData = dataInput?.value.trim() ?? '';
      if (!mcpData) {
        this.setNotice('warn', 'Figma URL 또는 JSON 데이터를 먼저 입력하세요.');
        return;
      }
      this.setNotice('info', 'MCP 데이터를 불러오는 중입니다...');
      vscode.postMessage({ command: 'figma.fetchData', mcpData });
    });

    document.getElementById('btn-screenshot')?.addEventListener('click', () => {
      const mcpData = dataInput?.value.trim() ?? '';
      if (!mcpData) {
        this.setNotice('warn', '스크린샷을 위해 MCP 데이터를 먼저 입력하세요.');
        return;
      }
      if (!this.connected) {
        this.setNotice('warn', '스크린샷은 MCP 연결 후에만 가능합니다.');
        return;
      }
      this.setNotice('info', '스크린샷을 생성하는 중입니다...');
      vscode.postMessage({ command: 'figma.screenshot', mcpData });
    });

    this.updateActionState();
  }

  onStatus(connected: boolean, methods: string[], error?: string) {
    this.connected = connected;
    const dot = document.getElementById('figma-status-dot');
    const text = document.getElementById('figma-status-text');

    if (dot) dot.className = `status-dot${connected ? ' connected' : ''}`;
    if (text) {
      if (connected) {
        text.textContent = `연결됨 (${methods.length} tools available)`;
        text.style.color = '';
        this.setNotice('success', 'MCP 연결이 완료되었습니다.');
      } else {
        text.textContent = '연결되지 않음';
        text.style.color = 'var(--vscode-errorForeground)';
        if (error) {
          this.setNotice('error', `연결 실패: ${error}`);
        } else {
          this.setNotice('warn', 'MCP 서버에 연결되지 않았습니다.');
        }
      }
    }

    this.updateActionState();
  }

  onDataResult(data: unknown) {
    const preview = document.getElementById('figma-data-preview') as HTMLPreElement | null;
    if (!preview) return;

    const text = this.stringifyForPreview(data);
    preview.textContent = text;
    preview.classList.add('visible');
    this.setNotice('success', 'MCP 데이터를 불러왔습니다.');
  }

  onScreenshotResult(base64: string) {
    const img = document.getElementById('figma-screenshot-preview') as HTMLImageElement | null;
    if (!img) return;

    img.src = `data:image/png;base64,${base64}`;
    img.classList.add('visible');
    this.setNotice('success', '스크린샷을 가져왔습니다. 에디터에도 함께 열렸습니다.');
  }

  onError(message: string) {
    this.setNotice('error', message);
  }

  private updateActionState() {
    const dataInput = document.getElementById('mcp-data') as HTMLTextAreaElement | null;
    const hasData = !!dataInput?.value.trim();

    const fetchBtn = document.getElementById('btn-fetch') as HTMLButtonElement | null;
    const screenshotBtn = document.getElementById('btn-screenshot') as HTMLButtonElement | null;

    if (fetchBtn) fetchBtn.disabled = !hasData;
    if (screenshotBtn) screenshotBtn.disabled = !hasData || !this.connected;
  }

  private setNotice(level: 'info' | 'success' | 'warn' | 'error', message: string) {
    const notice = document.getElementById('figma-notice');
    if (!notice) return;
    notice.className = `notice ${level}`;
    notice.textContent = message;
  }

  private stringifyForPreview(data: unknown): string {
    if (typeof data === 'string') return data;
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return '[Unable to render data preview]';
    }
  }
}
