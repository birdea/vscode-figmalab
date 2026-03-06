import { LogEntry } from '../../../types';

export class LogLayer {
  render(): string {
    return `
<div class="panel">
  <div class="panel-title">Runtime Log</div>
  <div class="description-text" id="log-empty">아직 로그가 없습니다.</div>
  <div class="log-area" id="log-area"></div>
</div>`;
  }

  mount() {
    // No specific DOM event listeners needed for local buttons anymore
  }

  appendEntry(entry: LogEntry) {
    const area = document.getElementById('log-area');
    const empty = document.getElementById('log-empty');
    if (!area) return;
    if (empty) empty.style.display = 'none';

    const el = document.createElement('div');
    el.className = `log-entry ${entry.level}`;

    const time = entry.timestamp.slice(11, 19);
    el.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-layer">[${entry.layer}]</span>
      <span class="log-msg">${this.escape(entry.message)}</span>`;

    area.appendChild(el);

    const entries = area.querySelectorAll('.log-entry');
    if (entries.length > 500) {
      entries[0].remove();
    }

    area.scrollTop = area.scrollHeight;
  }

  clear() {
    const area = document.getElementById('log-area');
    const empty = document.getElementById('log-empty');
    if (area) area.innerHTML = '';
    if (empty) empty.style.display = '';
  }

  private escape(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
