import { vscode } from '../vscodeApi';
import { AgentType, ModelInfo } from '../../../types';

export class AgentLayer {
  private models: ModelInfo[] = [];

  render(): string {
    return `
<div class="panel">
  <div class="panel-title">Agent Setup</div>
  <div class="field-group">
    <label for="agent-select">AI Agent</label>
    <select id="agent-select">
      <option value="gemini">Gemini</option>
      <option value="claude">Claude</option>
    </select>
  </div>
  <div class="field-group" style="margin-top: 8px;">
    <div class="row" style="justify-content: space-between;">
      <label for="api-key-input">API Key</label>
      <a href="#" id="link-get-api-key" style="font-size: 11px;">Get API Key</a>
    </div>
    <div class="row">
      <input type="password" id="api-key-input" placeholder="API Key 입력..." />
      <button class="primary" id="btn-save-key"><i class="codicon codicon-save"></i>저장</button>
    </div>
  </div>
  <div class="field-group" style="margin-top: 8px;">
    <div class="row" style="justify-content: space-between;">
      <label for="model-select">모델 선택</label>
      <a href="#" id="link-get-model-info" style="font-size: 11px;">Get Model Info</a>
    </div>
    <div class="row">
      <select id="model-select">
        <option value="">-- 모델 로드 --</option>
      </select>
      <button class="secondary icon-btn" id="btn-load-models" title="모델 목록 새로고침"><i class="codicon codicon-refresh"></i></button>
    </div>
  </div>
  <div class="description-text" id="agent-status" style="margin-top: 8px;">모델을 불러오면 현재 agent/model 상태가 여기에 표시됩니다.</div>
  <div class="notice hidden" id="agent-notice" style="margin-top: 8px;"></div>
</div>
`;
  }

  mount() {
    document.getElementById('agent-select')?.addEventListener('change', (e) => {
      const agent = (e.target as HTMLSelectElement).value as AgentType;
      vscode.postMessage({ command: 'state.setAgent', agent });
      this.updateModelList([]);
      this.updateStatus();
      this.setNotice('info', `${agent} 에이전트로 전환되었습니다. 모델을 다시 로드하세요.`);
    });

    document.getElementById('link-get-api-key')?.addEventListener('click', (e) => {
      e.preventDefault();
      const agent = (document.getElementById('agent-select') as HTMLSelectElement).value as AgentType;
      vscode.postMessage({ command: 'agent.getApiKeyHelp', agent });
    });

    document.getElementById('btn-save-key')?.addEventListener('click', () => {
      const agent = (document.getElementById('agent-select') as HTMLSelectElement).value as AgentType;
      const key = (document.getElementById('api-key-input') as HTMLInputElement).value.trim();
      if (!key) {
        this.setNotice('warn', '저장할 API Key를 입력하세요.');
        return;
      }
      vscode.postMessage({ command: 'agent.setApiKey', agent, key });
      const input = document.getElementById('api-key-input') as HTMLInputElement;
      input.value = '';
      input.placeholder = '저장됨 ✓';
      this.setNotice('success', `${agent} API Key를 저장했습니다.`);
    });

    document.getElementById('btn-load-models')?.addEventListener('click', () => {
      const agent = (document.getElementById('agent-select') as HTMLSelectElement).value as AgentType;
      this.setNotice('info', `${agent} 모델 목록을 불러오는 중입니다...`);
      vscode.postMessage({ command: 'agent.listModels', agent });
    });

    document.getElementById('link-get-model-info')?.addEventListener('click', (e) => {
      e.preventDefault();
      const agent = (document.getElementById('agent-select') as HTMLSelectElement).value as AgentType;
      const modelId = (document.getElementById('model-select') as HTMLSelectElement).value;
      if (!modelId) {
        this.setNotice('warn', '모델을 먼저 선택하세요.');
        return;
      }
      vscode.postMessage({ command: 'agent.getModelInfoHelp', agent, modelId });
    });

    document.getElementById('model-select')?.addEventListener('change', (e) => {
      const modelId = (e.target as HTMLSelectElement).value;
      vscode.postMessage({ command: 'state.setModel', model: modelId });
      this.updateStatus();
    });

    this.updateStatus();
  }

  onModelsResult(models: ModelInfo[]) {
    this.models = models;
    this.updateModelList(models);
    if (models.length > 0) {
      this.setNotice('success', `${models.length}개의 모델을 불러왔습니다.`);
    } else {
      this.setNotice('warn', '사용 가능한 모델이 없습니다. API Key와 권한을 확인하세요.');
    }
    this.updateStatus();
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

  onError(message: string) {
    this.setNotice('error', message);
  }

  private updateStatus() {
    const agent = (document.getElementById('agent-select') as HTMLSelectElement | null)?.value;
    const model = (document.getElementById('model-select') as HTMLSelectElement | null)?.value;
    const status = document.getElementById('agent-status');
    if (!status || !agent) return;

    if (!model) {
      status.textContent = `현재 agent: ${agent}. 모델이 선택되지 않았습니다.`;
      return;
    }
    status.textContent = `현재 agent: ${agent} / model: ${model}`;
  }

  private setNotice(level: 'info' | 'success' | 'warn' | 'error', message: string) {
    const notice = document.getElementById('agent-notice');
    if (!notice) return;
    notice.className = `notice ${level}`;
    notice.textContent = message;
  }
}
