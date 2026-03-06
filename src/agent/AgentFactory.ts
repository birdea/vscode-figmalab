import { AgentType } from '../types';
import { IAgent } from './BaseAgent';
import { GeminiAgent } from './GeminiAgent';
import { ClaudeAgent } from './ClaudeAgent';

export class AgentFactory {
  private static instances: Map<AgentType, IAgent> = new Map();

  static getAgent(type: AgentType): IAgent {
    if (!this.instances.has(type)) {
      this.instances.set(type, this.createAgent(type));
    }
    return this.instances.get(type)!;
  }

  private static createAgent(type: AgentType): IAgent {
    switch (type) {
      case 'gemini':
        return new GeminiAgent();
      case 'claude':
        return new ClaudeAgent();
      default:
        throw new Error(`Unsupported agent type: ${type}`);
    }
  }
}
