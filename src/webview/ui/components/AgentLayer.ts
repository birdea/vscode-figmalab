import { vscode } from '../vscodeApi';
import { AgentType, ModelInfo } from '../../../types';

export class AgentLayer {
  private models: ModelInfo[] = [];

  render(): string {
    return `
<div class="field-group">
  <label>AI Agent</label>
  <select id="agent-select">
    <option value="gemini">Gemini</option>
    <option value="claude">Claude</option>
  </select>
</div>
<div class="field-group">
  <div class="row" style="justify-content: space-between;">
    <label>API Key</label>
    <a href="#" id="link-get-api-key" style="font-size: 11px;">Get API Key</a>
  </div>
  <div class="row">
    <input type="password" id="api-key-input" placeholder="API Key 입력..." />
    <button class="primary" id="btn-save-key"><i class="codicon codicon-save"></i>저장</button>
  </div>
</div>
<div class="field-group">
  <div class="row" style="justify-content: space-between;">
    <label>모델 선택</label>
    <a href="#" id="link-get-model-info" style="font-size: 11px;">Get Model Info</a>
  </div>
  <div class="row">
    <select id="model-select">
      <option value="">-- 모델 로드 --</option>
    </select>
    <button class="secondary icon-btn" id="btn-load-models" title="모델 목록 새로고침"><i class="codicon codicon-refresh"></i></button>
  </div>
</div>`;
  }

  mount() {
    document.getElementById('agent-select')?.addEventListener('change', (e) => {
      const agent = (e.target as HTMLSelectElement).value as AgentType;
      vscode.postMessage({ command: 'state.setAgent', agent });
      this.updateModelList([]);
    });

    document.getElementById('link-get-api-key')?.addEventListener('click', (e) => {
      e.preventDefault();
      const agent = (document.getElementById('agent-select') as HTMLSelectElement).value as AgentType;
      vscode.postMessage({ command: 'agent.getApiKeyHelp', agent });
    });

    document.getElementById('btn-save-key')?.addEventListener('click', () => {
      const agent = (document.getElementById('agent-select') as HTMLSelectElement).value as AgentType;
      const key = (document.getElementById('api-key-input') as HTMLInputElement).value.trim();
      if (!key) return;
      vscode.postMessage({ command: 'agent.setApiKey', agent, key });
      const input = document.getElementById('api-key-input') as HTMLInputElement;
      input.value = '';
      input.placeholder = '저장됨 ✓';
    });

    document.getElementById('btn-load-models')?.addEventListener('click', () => {
      const agent = (document.getElementById('agent-select') as HTMLSelectElement).value as AgentType;
      vscode.postMessage({ command: 'agent.listModels', agent });
    });

    document.getElementById('link-get-model-info')?.addEventListener('click', (e) => {
      e.preventDefault();
      const agent = (document.getElementById('agent-select') as HTMLSelectElement).value as AgentType;
      const modelId = (document.getElementById('model-select') as HTMLSelectElement).value;
      if (!modelId) return;
      vscode.postMessage({ command: 'agent.getModelInfoHelp', agent, modelId });
    });

    document.getElementById('model-select')?.addEventListener('change', (e) => {
      const modelId = (e.target as HTMLSelectElement).value;
      vscode.postMessage({ command: 'state.setModel', model: modelId });
    });
  }

  onModelsResult(models: ModelInfo[]) {
    this.models = models;
    this.updateModelList(models);
  }

  private updateModelList(models: ModelInfo[]) {
    const select = document.getElementById('model-select') as HTMLSelectElement;
    if (!select) return;
    select.innerHTML = '';
    if (models.length === 0) {
      select.innerHTML = '<option value="">-- 모델 로드 --</option>';
      return;
    }
    models.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      select.appendChild(opt);
    });
    // Sync model state with extension host
    if (models.length > 0) {
      vscode.postMessage({ command: 'state.setModel', model: models[0].id });
    }
  }
}
