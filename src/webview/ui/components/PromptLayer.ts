import { vscode } from '../vscodeApi';
import { OutputFormat, PromptPayload } from '../../../types';

export class PromptLayer {
  private generatedCode = '';
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  render(): string {
    return `
<div class="field-group">
  <div class="checkbox-row">
    <input type="checkbox" id="use-user-prompt" checked />
    <label for="use-user-prompt" style="margin:0">사용자 프롬프트</label>
  </div>
  <textarea id="user-prompt" placeholder="추가 지시사항 입력..."></textarea>
</div>
<div class="checkbox-row">
  <input type="checkbox" id="use-mcp-data" checked />
  <label for="use-mcp-data" style="margin:0">MCP 데이터 포함</label>
</div>
<div class="field-group">
  <label>출력 포맷</label>
  <select id="output-format">
    <option value="tsx">TSX (React)</option>
    <option value="html">HTML</option>
    <option value="scss">SCSS</option>
    <option value="tailwind">Tailwind CSS</option>
    <option value="kotlin">Kotlin (Compose)</option>
  </select>
</div>
<div class="token-estimate" id="token-estimate">0.0KB / ~0 tok</div>
<button class="primary" id="btn-generate" style="width:100%"><i class="codicon codicon-play"></i>Generate</button>
<pre class="code-output" id="code-output"></pre>
<div class="btn-row" id="code-actions" style="display:none">
  <button class="primary" id="btn-insert"><i class="codicon codicon-insert"></i>에디터에 삽입</button>
  <button class="secondary" id="btn-save-file"><i class="codicon codicon-save"></i>파일로 저장</button>
</div>`;
  }

  mount() {
    const userPromptEl = document.getElementById('user-prompt') as HTMLTextAreaElement;
    const outputFormatEl = document.getElementById('output-format') as HTMLSelectElement;

    userPromptEl?.addEventListener('input', () => this.updateEstimate());
    outputFormatEl?.addEventListener('change', () => this.updateEstimate());

    document.getElementById('btn-generate')?.addEventListener('click', () => {
      const useUserPrompt = (document.getElementById('use-user-prompt') as HTMLInputElement).checked;
      const useMcpData = (document.getElementById('use-mcp-data') as HTMLInputElement).checked;
      const outputFormat = outputFormatEl.value as OutputFormat;

      const payload: PromptPayload = {
        userPrompt: useUserPrompt ? userPromptEl.value.trim() : undefined,
        mcpData: useMcpData ? undefined : null,
        outputFormat,
      };

      const codeOutput = document.getElementById('code-output') as HTMLPreElement;
      codeOutput.textContent = '';
      codeOutput.classList.add('visible');
      const codeActions = document.getElementById('code-actions');
      if (codeActions) {
        codeActions.style.display = 'none';
      }
      this.generatedCode = '';

      vscode.postMessage({ command: 'prompt.generate', payload });
      (document.getElementById('btn-generate') as HTMLButtonElement).disabled = true;
    });

    document.getElementById('btn-insert')?.addEventListener('click', () => {
      if (this.generatedCode) {
        vscode.postMessage({ command: 'editor.insert', code: this.generatedCode });
      }
    });

    document.getElementById('btn-save-file')?.addEventListener('click', () => {
      if (this.generatedCode) {
        const format = outputFormatEl.value;
        const ext = format === 'tsx' ? 'tsx' : format === 'scss' ? 'scss' : format === 'kotlin' ? 'kt' : 'html';
        vscode.postMessage({
          command: 'editor.saveFile',
          code: this.generatedCode,
          filename: `generated.${ext}`,
        });
      }
    });
  }

  private updateEstimate() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const userPrompt = (document.getElementById('user-prompt') as HTMLTextAreaElement).value;
      const bytes = new TextEncoder().encode(userPrompt).length;
      const kb = (bytes / 1024).toFixed(1);
      const tokens = Math.ceil(userPrompt.length / 4).toLocaleString();
      const el = document.getElementById('token-estimate');
      if (el) el.textContent = `${kb}KB / ~${tokens} tok`;
    }, 300);
  }

  onChunk(text: string) {
    this.generatedCode += text;
    const codeOutput = document.getElementById('code-output') as HTMLPreElement;
    if (codeOutput) {
      codeOutput.textContent = this.generatedCode;
      codeOutput.scrollTop = codeOutput.scrollHeight;
    }
  }

  onResult(code: string) {
    this.generatedCode = code;
    const codeOutput = document.getElementById('code-output') as HTMLPreElement;
    if (codeOutput) {
      codeOutput.textContent = code;
      codeOutput.classList.add('visible');
    }
    const actions = document.getElementById('code-actions');
    if (actions) actions.style.display = 'flex';
    (document.getElementById('btn-generate') as HTMLButtonElement).disabled = false;
  }

  onError(message: string) {
    const codeOutput = document.getElementById('code-output') as HTMLPreElement;
    if (codeOutput) {
      codeOutput.innerHTML = `<span style="color:var(--vscode-errorForeground)">Error: ${this.escapeHTML(message)}</span>`;
      codeOutput.classList.add('visible');
    }
    
    const actions = document.getElementById('code-actions');
    if (actions) actions.style.display = 'none';
      
    (document.getElementById('btn-generate') as HTMLButtonElement).disabled = false;
  }

  private escapeHTML(str: string): string {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
  }
}
