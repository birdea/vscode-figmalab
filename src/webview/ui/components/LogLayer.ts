import { LogEntry } from '../../../types';

export class LogLayer {
  render(): string {
    return `<div class="log-area" id="log-area"></div>`;
  }

  mount() {
    // No specific DOM event listeners needed for local buttons anymore
  }

  appendEntry(entry: LogEntry) {
    const area = document.getElementById('log-area');
    if (!area) return;

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

  private escape(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
