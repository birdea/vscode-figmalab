import { FigmaLayer } from './components/FigmaLayer';
import { AgentLayer } from './components/AgentLayer';
import { PromptLayer } from './components/PromptLayer';
import { LogLayer } from './components/LogLayer';
import { HostToWebviewMessage } from '../../types';

type HostEvent = HostToWebviewMessage['event'];
type HostMessage<K extends HostEvent> = Extract<HostToWebviewMessage, { event: K }>;
type MessageHandlerMap<TEvent extends HostEvent> = {
  [K in TEvent]: (message: HostMessage<K>) => void;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasEvent<TEvent extends HostEvent>(
  handlers: MessageHandlerMap<TEvent>,
  event: unknown,
): event is TEvent {
  return typeof event === 'string' && Object.hasOwn(handlers, event);
}

function bindMessageHandlers<TEvent extends HostEvent>(handlers: MessageHandlerMap<TEvent>) {
  window.addEventListener('message', (event) => {
    if (!isObject(event.data) || !hasEvent(handlers, event.data.event)) {
      return;
    }

    const msg = event.data as HostMessage<TEvent>;
    const handler = handlers[msg.event];
    handler(msg);
  });
}

export function init() {
  const app = document.getElementById('app');
  if (!app) return;

  const section = document.body.dataset.section;

  switch (section) {
    case 'setup': {
      const figma = new FigmaLayer();
      const agent = new AgentLayer();
      app.innerHTML = figma.render() + agent.render();
      figma.mount();
      agent.mount();
      bindMessageHandlers({
        'figma.connectRequested': () => figma.requestConnect(),
        'figma.status': (msg) => figma.onStatus(msg.connected, msg.methods, msg.error),
        'figma.dataResult': (msg) => figma.onDataResult(msg.data),
        'figma.dataFetchError': (msg) => {
          figma.onError(msg.message);
          figma.onDataResult(msg.fallbackData);
        },
        'figma.screenshotResult': (msg) => figma.onScreenshotResult(msg.base64),
        'agent.modelsResult': (msg) => agent.onModelsResult(msg.models),
        'agent.state': (msg) => agent.onState(msg.agent, msg.model, msg.hasApiKey),
        'agent.settingsSaved': (msg) => agent.onSettingsSaved(msg.agent, msg.model, msg.hasApiKey),
        'agent.settingsCleared': (msg) => agent.onSettingsCleared(msg.agent),
        error: (msg) => {
          if (msg.source === 'figma') figma.onError(msg.message);
          if (msg.source === 'agent' || msg.source === 'system') agent.onError(msg.message);
        },
      });
      break;
    }
    case 'prompt': {
      const layer = new PromptLayer();
      app.innerHTML = layer.render();
      layer.mount();
      bindMessageHandlers({
        'prompt.generateRequested': () => layer.onGenerateRequested(),
        'prompt.streaming': (msg) => layer.onStreaming(msg.progress, msg.text),
        'prompt.result': (msg) => layer.onResult(msg.code, msg.complete, msg.message, msg.progress),
        'prompt.estimateResult': (msg) => layer.onEstimateResult(msg.tokens, msg.kb),
        'prompt.error': (msg) => layer.onError(msg.message, msg.code),
        error: (msg) => {
          if (msg.source === 'prompt' || msg.source === 'system') {
            layer.onHostError(msg.message);
          }
        },
      });
      break;
    }
    case 'log': {
      const layer = new LogLayer();
      app.innerHTML = layer.render();
      layer.mount();
      bindMessageHandlers({
        'log.append': (msg) => layer.appendEntry(msg.entry),
        'log.clear': () => layer.clear(),
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
