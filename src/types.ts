// Agent types
export type AgentType = 'gemini' | 'claude' | 'codex';
export type OutputFormat = 'html' | 'tsx' | 'scss' | 'tailwind' | 'kotlin';
export type LogLevel = 'info' | 'warn' | 'error' | 'success';
export type LayerType = 'figma' | 'agent' | 'prompt' | 'editor' | 'system';

// Log entry
export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  layer: LayerType;
  message: string;
  detail?: string;
}

// Model info
export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

// Prompt payload
export interface PromptPayload {
  userPrompt?: string;
  mcpData?: unknown;
  outputFormat: OutputFormat;
  model?: string;
  agent?: AgentType;
}

// MCP parsed data
export interface ParsedMcpData {
  fileId: string;
  nodeId: string;
  raw: unknown;
}

// Webview → Host messages
export type WebviewToHostMessage =
  | { command: 'figma.connect'; endpoint: string }
  | { command: 'figma.fetchData'; mcpData: string }
  | { command: 'figma.screenshot'; mcpData: string }
  | { command: 'agent.getApiKeyHelp'; agent: AgentType }
  | { command: 'agent.getModelInfoHelp'; agent: AgentType; modelId: string }
  | { command: 'agent.setApiKey'; agent: AgentType; key: string }
  | { command: 'agent.listModels'; agent: AgentType }
  | { command: 'state.setAgent'; agent: AgentType }
  | { command: 'state.setModel'; model: string }
  | { command: 'prompt.generate'; payload: PromptPayload }
  | { command: 'editor.insert'; code: string }
  | { command: 'editor.saveFile'; code: string; filename: string };

// Host → Webview messages
export type HostToWebviewMessage =
  | { event: 'figma.status'; connected: boolean; methods: string[]; error?: string }
  | { event: 'figma.dataResult'; data: unknown }
  | { event: 'figma.screenshotResult'; base64: string }
  | { event: 'agent.modelsResult'; models: ModelInfo[] }
  | { event: 'agent.modelInfo'; info: ModelInfo }
  | { event: 'prompt.generating'; progress: number }
  | { event: 'prompt.chunk'; text: string }
  | { event: 'prompt.result'; code: string; format: OutputFormat }
  | { event: 'prompt.error'; message: string }
  | { event: 'log.append'; entry: LogEntry }
  | { event: 'error'; source: LayerType; message: string };
