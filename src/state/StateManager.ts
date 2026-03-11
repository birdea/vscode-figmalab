import { AgentType, ScreenshotAsset } from '../types';

export class StateManager {
  private currentAgent: AgentType = 'gemini';
  private currentModel = '';
  private lastDesignContextData: unknown = null;
  private lastMetadata: unknown = null;
  private lastMcpInput = '';
  private lastScreenshot: ScreenshotAsset | null = null;

  getAgent(): AgentType {
    return this.currentAgent;
  }

  setAgent(agent: AgentType) {
    this.currentAgent = agent;
    this.currentModel = '';
  }

  getModel(): string {
    return this.currentModel;
  }

  setModel(model: string) {
    this.currentModel = model;
  }

  getLastDesignContextData(): unknown {
    return this.lastDesignContextData;
  }

  setLastDesignContextData(data: unknown) {
    this.lastDesignContextData = data;
  }

  clearLastDesignContextData() {
    this.lastDesignContextData = null;
  }

  getLastMetadata(): unknown {
    return this.lastMetadata;
  }

  setLastMetadata(data: unknown) {
    this.lastMetadata = data;
  }

  clearLastMetadata() {
    this.lastMetadata = null;
  }

  getLastMcpInput(): string {
    return this.lastMcpInput;
  }

  setLastMcpInput(input: string) {
    this.lastMcpInput = input;
  }

  clearLastMcpInput() {
    this.lastMcpInput = '';
  }

  getLastScreenshot(): ScreenshotAsset | null {
    return this.lastScreenshot;
  }

  setLastScreenshot(screenshot: ScreenshotAsset | null) {
    this.lastScreenshot = screenshot;
  }

  clearLastScreenshot() {
    this.lastScreenshot = null;
  }

  getLastMcpData(): unknown {
    return this.getLastDesignContextData();
  }

  setLastMcpData(data: unknown) {
    this.setLastDesignContextData(data);
  }

  clearLastMcpData() {
    this.clearLastDesignContextData();
  }

  resetAgentState() {
    this.currentAgent = 'gemini';
    this.currentModel = '';
  }
}
