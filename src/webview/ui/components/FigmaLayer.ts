import { vscode } from '../vscodeApi';

export class FigmaLayer {
  render(): string {
    return `
<div class="status-row" id="figma-status-row" style="margin-bottom: 8px;">
  <span class="status-dot" id="figma-status-dot"></span>
  <span id="figma-status-text" class="status-text">연결 안됨</span>
</div>
<div class="row">
  <input type="text" id="mcp-endpoint" value="http://localhost:3845" placeholder="MCP Endpoint" />
  <button class="primary" id="btn-connect"><i class="codicon codicon-plug"></i>Connect</button>
</div>
<div class="field-group">
  <label>MCP 데이터 입력 (URL 또는 JSON)</label>
  <textarea id="mcp-data" placeholder="https://figma.com/file/... 또는 JSON"></textarea>
</div>
<div class="btn-row">
  <button class="primary" id="btn-fetch"><i class="codicon codicon-cloud-download"></i>Fetch</button>
  <button class="primary" id="btn-screenshot"><i class="codicon codicon-device-camera"></i>Screenshot</button>
</div>`;
  }

  mount() {
    // Auto-connect on mount
    const endpointInput = document.getElementById('mcp-endpoint') as HTMLInputElement;
    if (endpointInput) {
      vscode.postMessage({ command: 'figma.connect', endpoint: endpointInput.value.trim() });
    }

    document.getElementById('btn-connect')?.addEventListener('click', () => {
      const endpoint = (document.getElementById('mcp-endpoint') as HTMLInputElement).value.trim();
      vscode.postMessage({ command: 'figma.connect', endpoint });
    });

    document.getElementById('btn-fetch')?.addEventListener('click', () => {
      const mcpData = (document.getElementById('mcp-data') as HTMLTextAreaElement).value.trim();
      if (!mcpData) return;
      vscode.postMessage({ command: 'figma.fetchData', mcpData });
    });

    document.getElementById('btn-screenshot')?.addEventListener('click', () => {
      const mcpData = (document.getElementById('mcp-data') as HTMLTextAreaElement).value.trim();
      if (!mcpData) {
        alert('MCP 데이터를 먼저 입력하세요');
        return;
      }
      vscode.postMessage({ command: 'figma.screenshot', mcpData });
    });
  }

  onStatus(connected: boolean, methods: string[], error?: string) {
    const dot = document.getElementById('figma-status-dot');
    const text = document.getElementById('figma-status-text');
    const mcpDataInput = document.getElementById('mcp-data') as HTMLTextAreaElement;
    
    if (dot) dot.className = `status-dot${connected ? ' connected' : ''}`;
    if (text) {
      if (connected) {
        text.textContent = `연결됨 (${methods.length} tools)`;
        text.style.color = '';
        
        // Auto-populate sample data if connected and empty
        if (mcpDataInput && !mcpDataInput.value.trim()) {
          mcpDataInput.value = 'https://figma.com/file/mock-1234?node-id=0:1';
        }
      } else {
        text.textContent = `연결 안됨${error ? ` - ${error}` : ''}`;
        text.style.color = 'var(--vscode-errorForeground)';
      }
    }
  }
}
