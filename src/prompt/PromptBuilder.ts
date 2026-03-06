import { PromptPayload, OutputFormat } from '../types';
import { estimateTokens, TokenEstimate } from './TokenEstimator';

const FORMAT_INSTRUCTIONS: Record<OutputFormat, string> = {
  html: 'Generate semantic HTML5 with inline CSS. Use modern HTML elements.',
  tsx: 'Generate a React functional component in TypeScript (TSX). Use proper typing and hooks where needed.',
  scss: 'Generate SCSS stylesheet with BEM naming convention and CSS custom properties.',
  tailwind: 'Generate HTML with Tailwind CSS utility classes. Use responsive design principles.',
  kotlin: 'Generate Jetpack Compose UI code in Kotlin. Use Material3 components.',
};

export class PromptBuilder {
  build(payload: PromptPayload): string {
    const lines: string[] = [
      `You are an expert UI developer. Based on the provided Figma design data, generate ${payload.outputFormat.toUpperCase()} code that faithfully reproduces the layout.`,
      FORMAT_INSTRUCTIONS[payload.outputFormat],
      'Output ONLY valid code. No explanation, no markdown code fences.',
      '',
    ];

    if (payload.userPrompt?.trim()) {
      lines.push('=== User Instruction ===');
      lines.push(payload.userPrompt.trim());
      lines.push('');
    }

    if (payload.mcpData !== undefined && payload.mcpData !== null) {
      lines.push('=== Figma Design Data (MCP) ===');
      lines.push(
        typeof payload.mcpData === 'string'
          ? payload.mcpData
          : JSON.stringify(payload.mcpData, null, 2),
      );
      lines.push('');
    }

    lines.push(`=== Output Format: ${payload.outputFormat.toUpperCase()} ===`);
    return lines.join('\n');
  }

  estimate(payload: PromptPayload): TokenEstimate {
    const text = this.build(payload);
    return estimateTokens(text);
  }
}
