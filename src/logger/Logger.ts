import * as vscode from 'vscode';
import { LogEntry, LogLevel, LayerType } from '../types';
import { MAX_LOG_ENTRIES } from '../constants';

export class Logger {
  private static entries: LogEntry[] = [];
  private static outputChannel: vscode.OutputChannel;
  private static onLogCallback?: (entry: LogEntry) => void;

  static initialize(channel: vscode.OutputChannel) {
    this.outputChannel = channel;
  }

  static onLog(callback: (entry: LogEntry) => void) {
    this.onLogCallback = callback;
  }

  static log(level: LogLevel, layer: LayerType, message: string, detail?: string): LogEntry {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      layer,
      message,
      detail,
    };

    this.entries.push(entry);
    if (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries.shift();
    }

    const logLine = `[${entry.timestamp}] [${level.toUpperCase()}] [${layer}] ${message}`;
    this.outputChannel?.appendLine(logLine);
    if (detail) {
      this.outputChannel?.appendLine(`  ${detail}`);
    }

    this.onLogCallback?.(entry);
    return entry;
  }

  static info(layer: LayerType, message: string, detail?: string) {
    return this.log('info', layer, message, detail);
  }

  static warn(layer: LayerType, message: string, detail?: string) {
    return this.log('warn', layer, message, detail);
  }

  static error(layer: LayerType, message: string, detail?: string) {
    return this.log('error', layer, message, detail);
  }

  static success(layer: LayerType, message: string, detail?: string) {
    return this.log('success', layer, message, detail);
  }

  static getEntries(): LogEntry[] {
    return [...this.entries];
  }

  static clear() {
    this.entries = [];
    this.outputChannel?.clear();
  }

  static toText(): string {
    return this.entries
      .map((e) => `[${e.timestamp}] [${e.level.toUpperCase()}] [${e.layer}] ${e.message}${e.detail ? '\n  ' + e.detail : ''}`)
      .join('\n');
  }

  static toJson(): string {
    return JSON.stringify(this.entries, null, 2);
  }
}
