import * as assert from 'assert';
import nock from 'nock';
import { GeminiAgent } from '../../src/agent/GeminiAgent';
import { ClaudeAgent } from '../../src/agent/ClaudeAgent';
import { Logger } from '../../src/logger/Logger';
import { PromptBuilder } from '../../src/prompt/PromptBuilder';

suite('Agent Implementations', () => {
  setup(() => {
    Logger.initialize({ appendLine: () => {}, clear: () => {} } as any);
  });

  teardown(() => {
    nock.cleanAll();
  });

  suite('GeminiAgent', () => {
    let agent: GeminiAgent;

    setup(() => {
      agent = new GeminiAgent();
    });

    test('PromptBuilder includes context for agent payload', () => {
      const payload = { 
        outputFormat: 'html', 
        userPrompt: 'make it blue',
        mcpData: { component: 'Button' }
      };
      const prompt = new PromptBuilder().build(payload);
      assert.ok(prompt.toLowerCase().includes('html'));
      assert.ok(prompt.includes('make it blue'));
      assert.ok(prompt.includes('Button'));
    });

    test('generateCode handles errors', async () => {
      await agent.setApiKey('test-key');
      nock('https://generativelanguage.googleapis.com')
        .post(/.*/)
        .reply(500, 'Error');

      try {
        const gen = agent.generateCode({ outputFormat: 'html', userPrompt: 'test' });
        await gen.next();
        assert.fail('Should throw');
      } catch (e) {
        assert.ok(e);
      }
    });
  });

  suite('ClaudeAgent', () => {
    let agent: ClaudeAgent;

    setup(() => {
      agent = new ClaudeAgent();
    });

    test('PromptBuilder includes context for agent payload', () => {
      const payload = { 
        outputFormat: 'tsx', 
        userPrompt: 'dark mode',
      };
      const prompt = new PromptBuilder().build(payload);
      assert.ok(prompt.toLowerCase().includes('tsx'));
      assert.ok(prompt.includes('dark mode'));
    });

    test('getModelInfo returns correct model', async () => {
      const info = await agent.getModelInfo('claude-sonnet-4-6');
      assert.strictEqual(info.id, 'claude-sonnet-4-6');
    });

    test('listModels uses configured catalog when provided', async () => {
      const vscode = require('vscode');
      const getStub = vscode.workspace.getConfiguration().get;
      getStub.withArgs('figmalab.claudeModels').returns([
        { id: 'claude-custom', name: 'Claude Custom', outputTokenLimit: 4096 },
      ]);

      const models = await agent.listModels();
      assert.strictEqual(models.length, 1);
      assert.strictEqual(models[0].id, 'claude-custom');
      assert.strictEqual(models[0].name, 'Claude Custom');
    });

    test('generateCode handles errors', async () => {
      await agent.setApiKey('test-key');
      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(401, { error: { message: 'Invalid' } });

      try {
        const gen = agent.generateCode({ outputFormat: 'tsx', userPrompt: 'test' });
        await gen.next();
        assert.fail('Should throw');
      } catch (e: any) {
        assert.ok(e.message);
      }
    });
  });
});
