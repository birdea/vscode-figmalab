import { FigmaLayer } from './components/FigmaLayer';
import { AgentLayer } from './components/AgentLayer';
import { PromptLayer } from './components/PromptLayer';
import { LogLayer } from './components/LogLayer';
import { HostToWebviewMessage } from '../../types';

function init() {
  const app = document.getElementById('app');
  if (!app) return;

  const section = document.body.dataset.section;

  switch (section) {
    case 'figma': {
      const layer = new FigmaLayer();
      app.innerHTML = layer.render();
      layer.mount();
      window.addEventListener('message', (event) => {
        const msg = event.data as HostToWebviewMessage;
        if (msg.event === 'figma.status') layer.onStatus(msg.connected, msg.methods, msg.error);
        else if (msg.event === 'figma.dataResult') layer.onDataResult(msg.data);
        else if (msg.event === 'figma.screenshotResult') layer.onScreenshotResult(msg.base64);
      });
      break;
    }
    case 'agent': {
      const layer = new AgentLayer();
      app.innerHTML = layer.render();
      layer.mount();
      window.addEventListener('message', (event) => {
        const msg = event.data as HostToWebviewMessage;
        if (msg.event === 'agent.modelsResult') layer.onModelsResult(msg.models);
      });
      break;
    }
    case 'prompt': {
      const layer = new PromptLayer();
      app.innerHTML = layer.render();
      layer.mount();
      window.addEventListener('message', (event) => {
        const msg = event.data as HostToWebviewMessage;
        if (msg.event === 'prompt.chunk') layer.onChunk(msg.text);
        else if (msg.event === 'prompt.result') layer.onResult(msg.code);
        else if (msg.event === 'prompt.error') layer.onError(msg.message);
      });
      break;
    }
    case 'log': {
      const layer = new LogLayer();
      app.innerHTML = layer.render();
      layer.mount();
      window.addEventListener('message', (event) => {
        const msg = event.data as HostToWebviewMessage;
        if (msg.event === 'log.append') layer.appendEntry(msg.entry);
      });
      break;
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
