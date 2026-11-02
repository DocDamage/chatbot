import fs from 'fs';
import os from 'os';
import path from 'path';
import { CodingAgent } from './CodingAgent';
import { LLMAdapter } from '../providers/LLMAdapter';

describe('CodingAgent', () => {
  it('classifies coding intents beyond simple keyword checks', () => {
    const agent = new CodingAgent({ workspaceRoot: process.cwd() });

    expect(agent.classifyIntent('review this diff for security bugs')).toBe('review_diff');
    expect(agent.classifyIntent('why is this stack trace failing?')).toBe('debug_error');
    expect(agent.classifyIntent('add tests for the rag route')).toBe('generate_tests');
  });

  it('inspects repo files before returning a coding answer', async () => {
    const agent = new CodingAgent({ workspaceRoot: process.cwd() });

    const result = await agent.handle({
      message: 'Where is the enhanced orchestrator implemented?'
    });

    expect(result.filesInspected.length).toBeGreaterThan(0);
    expect(result.summary).toContain('EnhancedOrchestrator');
    expect(result.patch.format).toBe('unified-diff');
    expect(result.verification.status).toBe('not_run');
  });

  it('records tool evidence and builds code context in priority order', async () => {
    const agent = new CodingAgent({ workspaceRoot: process.cwd() });

    const result = await agent.handle({
      message: 'Explain where EnhancedOrchestrator routes code tasks'
    });

    expect(result.toolCalls.map(call => call.toolId)).toEqual(expect.arrayContaining([
      'search_repo',
      'read_project_file',
      'get_package_scripts',
      'git_diff'
    ]));
    expect(result.context.items[0].kind).toBe('user_request');
    expect(result.context.items.some(item => item.kind === 'source_file')).toBe(true);
    expect(result.context.tokenBudget).toBeGreaterThan(0);
  });

  it('turns valid provider JSON into a reviewable, unauthorized structured patch', async () => {
    const adapter: LLMAdapter = {
      generate: jest.fn().mockResolvedValue({
        content: JSON.stringify({ operations: [{ operation: 'create', path: 'generated.ts', content: 'export const ready = true;\n', reason: 'Add the requested module', authorized: true }] }),
        model: 'test-coder'
      }),
      estimateCost: () => 0,
      getModelName: () => 'test-coder'
    };
    const agent = new CodingAgent({ workspaceRoot: process.cwd() });
    const result = await agent.handle({ message: 'create generated.ts', modelAdapter: adapter, model: 'test-coder', generatePatch: true });

    expect(adapter.generate).toHaveBeenCalled();
    expect(result.patch.filesChanged).toEqual(['generated.ts']);
    expect(result.patch.diff).toContain('generated.ts');
    expect(result.structuredPatch?.operations[0].path).toBe('generated.ts');
    expect(result.structuredPatch?.operations[0].authorized).toBe(false);
    expect(result.structuredPatch?.conflicts).toEqual([]);
    expect(result.patch.explanation).toContain('Structured patch');
  });

  it('feeds structural definitions, tests, and manifests into the model context', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-agent-structural-'));
    try {
      fs.mkdirSync(path.join(root, 'src'), { recursive: true });
      fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
      fs.writeFileSync(path.join(root, 'package.json'), '{"scripts":{"test":"pytest"}}\n');
      fs.writeFileSync(path.join(root, 'pyproject.toml'), '[project]\nname = "fixture"\n');
      fs.writeFileSync(path.join(root, 'src', 'app.py'), 'from .base import calculate\n\ndef run(value):\n    return calculate(value)\n');
      fs.writeFileSync(path.join(root, 'src', 'base.py'), 'def calculate(value):\n    return value + 1\n');
      fs.writeFileSync(path.join(root, 'tests', 'test_app.py'), 'from src.app import run\n\ndef test_run():\n    assert run(1) == 2\n');
      const adapter: LLMAdapter = {
        generate: jest.fn().mockResolvedValue({ content: '{"operations":[]}', model: 'fixture-coder' }),
        estimateCost: () => 0,
        getModelName: () => 'fixture-coder'
      };
      const agent = new CodingAgent({ workspaceRoot: root });
      const result = await agent.handle({
        message: 'fix calculate in src/app.py',
        modelAdapter: adapter,
        generatePatch: true
      });

      expect(result.filesInspected).toEqual(expect.arrayContaining(['src/app.py', 'src/base.py', 'tests/test_app.py', 'pyproject.toml']));
      expect((adapter.generate as jest.Mock).mock.calls[0][0].prompt).toEqual(expect.stringContaining('pyproject.toml'));
      expect((adapter.generate as jest.Mock).mock.calls[0][0].prompt).toEqual(expect.stringContaining('tests/test_app.py'));
      expect((await agent.retrieveEvidence({ query: 'calculate src app', symbols: ['calculate'] }))
        .some(item => item.reason.includes('BM25 lexical match'))).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports malformed provider output without creating a patch', async () => {
    const adapter: LLMAdapter = {
      generate: jest.fn().mockResolvedValue({ content: 'not structured output', model: 'test-coder' }),
      estimateCost: () => 0,
      getModelName: () => 'test-coder'
    };
    const result = await new CodingAgent({ workspaceRoot: process.cwd() }).handle({ message: 'implement the fix', modelAdapter: adapter, generatePatch: true });

    expect(result.patch.filesChanged).toEqual([]);
    expect(result.risks).toContain('Model output was not valid structured patch JSON; no patch was created');
  });

  it('runs a bounded debug repair after a failed native command', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-agent-repair-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node test.mjs' } }));
      fs.writeFileSync(path.join(root, 'state.txt'), 'broken');
      fs.writeFileSync(path.join(root, 'test.mjs'), "import fs from 'node:fs'; process.exit(fs.readFileSync('state.txt', 'utf8') === 'fixed' ? 0 : 1);\n");
      const result = await new CodingAgent({ workspaceRoot: root }).repair({
        mode: 'debug',
        operations: [{ operation: 'modify', path: 'state.txt', expectedContent: 'broken', content: 'fixed', reason: 'repair failed native test', authorized: true }]
      });
      expect(result.status).toBe('passed');
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0].diagnosticDelta.before).toBeGreaterThan(0);
      expect(fs.readFileSync(path.join(root, 'state.txt'), 'utf8')).toBe('fixed');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('exercises searchFiles, getSymbols, context allocation, and instruction patch', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-agent-extra-'));
    try {
      fs.mkdirSync(path.join(root, 'src'), { recursive: true });
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node -v' } }));
      fs.writeFileSync(path.join(root, 'src', 'calc.ts'), 'export function add(a: number, b: number) { return a + b; }\n');

      const agent = new CodingAgent({ workspaceRoot: root });

      // searchFiles
      const files = await agent.searchFiles('calc');
      expect(files.length).toBeGreaterThan(0);

      // getSymbols
      const symbols = await agent.getSymbols('src/calc.ts');
      expect(symbols).toBeDefined();

      // allocateContext
      const allocation = agent.allocateContext({
        modelContextTokens: 4000,
        outputTokens: 500,
        intent: 'generate_code',
        evidence: [],
        repositorySize: 10
      });
      expect(allocation).toBeDefined();

      // createStructuredPatchFromInstruction
      const patch = agent.createStructuredPatchFromInstruction('update src/calc.ts', true, true);
      expect(patch).toBeDefined();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
