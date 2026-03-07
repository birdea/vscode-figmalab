import { vscode } from '../vscodeApi';

export class FigmaLayer {
  private connected = false;
  private connecting = false;

  render(): string {
    return `
<section class="panel panel-compact">
  <div class="section-heading">
    <div>
      <div class="panel-title">Figma 연결</div>
      <div class="status-row section-status" id="figma-status-row">
        <span class="status-dot" id="figma-status-dot"></span>
        <span id="figma-status-text" class="status-text">연결되지 않음</span>
      </div>
    </div>
    <button class="text-btn" id="btn-open-settings">설정</button>
  </div>
  <div class="btn-row">
    <button class="primary" id="btn-connect"><i class="codicon codicon-plug"></i>연결하기</button>
  </div>
  <div class="notice info hidden" id="figma-guide"></div>
</section>
<section class="panel panel-compact">
  <div class="section-heading">
    <div class="panel-title">디자인 데이터</div>
  </div>
  <div class="field-group">
    <textarea id="mcp-data" placeholder="https://figma.com/file/... 또는 JSON"></textarea>
  </div>
  <div class="btn-row">
    <button class="primary" id="btn-fetch"><i class="codicon codicon-cloud-download"></i>데이터 가져오기</button>
    <button class="secondary" id="btn-screenshot"><i class="codicon codicon-device-camera"></i>스크린샷</button>
  </div>
  <div class="notice hidden" id="figma-notice"></div>
  <pre class="code-output" id="figma-data-preview"></pre>
  <img class="screenshot-preview" id="figma-screenshot-preview" alt="Figma screenshot preview" />
</section>
`;
  }

  mount() {
    const dataInput = document.getElementById('mcp-data') as HTMLTextAreaElement | null;

    dataInput?.addEventListener('input', () => this.updateActionState());

    document.getElementById('btn-fetch')?.addEventListener('click', () => {
      const mcpData = dataInput?.value.trim() ?? '';
      if (!mcpData) {
        this.setNotice('warn', 'Figma URL 또는 JSON 데이터를 먼저 입력하세요.');
        return;
      }
      this.setNotice('info', 'MCP 데이터를 불러오는 중입니다...');
      vscode.postMessage({ command: 'figma.fetchData', mcpData });
    });

    document.getElementById('btn-connect')?.addEventListener('click', () => {
      this.requestConnect();
    });

    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'figma.openSettings' });
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

  requestConnect() {
    this.connecting = true;
    this.syncConnectButton();
    this.setGuideMessage('연결을 시도하는 중입니다.');
    vscode.postMessage({ command: 'figma.connect' });
  }

  onStatus(connected: boolean, methods: string[], error?: string) {
    this.connected = connected;
    this.connecting = false;
    const dot = document.getElementById('figma-status-dot');
    const text = document.getElementById('figma-status-text');

    if (dot) dot.className = `status-dot${connected ? ' connected' : ''}`;
    if (text) {
      text.classList.toggle('status-text-error', !connected);
      if (connected) {
        text.textContent = '연결됨';
        this.setGuideMessage(methods.length > 0 ? `사용 가능 도구 ${methods.length}개` : '');
      } else {
        text.textContent = '연결되지 않음';
        if (error) {
          this.setNotice('error', error);
          this.setGuideMessage('서버 실행 여부와 엔드포인트를 확인하세요.');
        } else {
          this.clearNotice();
          this.setGuideMessage('');
        }
      }
    }

    this.renderToolList(methods, connected);
    this.updateActionState();
    this.syncConnectButton();
  }

  onDataResult(data: unknown) {
    const preview = document.getElementById('figma-data-preview') as HTMLPreElement | null;
    if (!preview) return;

    const text = this.stringifyForPreview(data);
    preview.textContent = text;
    preview.classList.add('visible');
    this.setNotice('success', '데이터를 불러왔습니다.');
  }

  onScreenshotResult(base64: string) {
    const img = document.getElementById('figma-screenshot-preview') as HTMLImageElement | null;
    if (!img) return;

    img.src = `data:image/png;base64,${base64}`;
    img.classList.add('visible');
    this.setNotice('success', '스크린샷을 가져왔습니다.');
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
    if (fetchBtn) {
      fetchBtn.title = hasData ? '' : 'Figma URL 또는 JSON을 입력하면 사용할 수 있습니다.';
    }
    if (screenshotBtn) {
      screenshotBtn.disabled = !hasData || !this.connected;
      screenshotBtn.title = !hasData
        ? 'Figma URL 또는 JSON을 먼저 입력하세요.'
        : !this.connected
          ? 'MCP 서버에 연결한 뒤 사용할 수 있습니다.'
          : '';
    }
  }

  private setNotice(level: 'info' | 'success' | 'warn' | 'error', message: string) {
    const notice = document.getElementById('figma-notice');
    if (!notice) return;
    if (!message) {
      notice.className = 'notice hidden';
      notice.textContent = '';
      return;
    }
    notice.className = `notice ${level}`;
    notice.textContent = message;
  }

  private setGuideMessage(message: string) {
    const guide = document.getElementById('figma-guide');
    if (!guide) return;
    guide.classList.toggle('hidden', !message);
    guide.textContent = message;
  }

  private clearNotice() {
    this.setNotice('info', '');
  }

  private syncConnectButton() {
    const connectBtn = document.getElementById('btn-connect') as HTMLButtonElement | null;
    if (!connectBtn) return;
    connectBtn.disabled = this.connecting;
    connectBtn.innerHTML = this.connecting
      ? '<i class="codicon codicon-loading codicon-modifier-spin"></i>연결 중...'
      : '<i class="codicon codicon-plug"></i>연결하기';
  }

  private renderToolList(methods: string[], connected: boolean) {
    const hasExtraTools = connected && methods.length > 2;
    this.setGuideMessage(hasExtraTools ? `도구 ${methods.length}개 사용 가능` : '');
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
