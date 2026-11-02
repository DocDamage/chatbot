import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

jest.mock('./ToolProcess', () => ({ runTool: jest.fn() }));
jest.mock('./DraftChecks', () => ({ checkDraft: jest.fn() }));

import { AiderAdapter } from './AiderAdapter';
import { CodingToolConfig } from './CodingToolConfig';
import { checkDraft } from './DraftChecks';
import { runTool } from './ToolProcess';
import { ToolFile } from './ToolWorkspace';

const mockedRunTool = runTool as jest.MockedFunction<typeof runTool>;
const mockedCheckDraft = checkDraft as jest.MockedFunction<typeof checkDraft>;

function captured(pathname: string, content: string, exists = true): ToolFile {
  return { path: pathname, content, exists, sha256: exists ? crypto.createHash('sha256').update(content).digest('hex') : '' };
}

function checks(errors: string[] = []) {
  return {
    errors,
    diagnostics: [],
    compiler: { status: errors.length ? 'failed' : 'passed', baselineErrors: 0, currentErrors: errors.length, configurations: [] },
    linter: { status: errors.length ? 'failed' : 'passed', version: undefined, baselineErrors: 0, currentErrors: errors.length },
    limitations: [],
  } as Awaited<ReturnType<typeof checkDraft>>;
}

function clearWorkspace(directory: string): void {
  fs.rmSync(path.join(directory, 'workspace'), { recursive: true, force: true });
}

describe('AiderAdapter', () => {
  let directory: string;
  let originalOpenAiKey: string | undefined;
  let originalContext7Key: string | undefined;

  const config = (overrides: Partial<CodingToolConfig> = {}): CodingToolConfig => ({
    enabled: true,
    root: process.cwd(),
    dataRoot: path.join(directory, 'jobs'),
    node: process.execPath,
    serena: 'serena',
    aiderPython: 'aider-python',
    astGrep: 'ast-grep',
    context7: 'context7',
    ollamaUrl: 'http://127.0.0.1:11434',
    model: 'qwen3:8b',
    timeoutMs: 5_000,
    contextTokens: 16_384,
    ...overrides,
  });

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aider-adapter-'));
    originalOpenAiKey = process.env.OPENAI_API_KEY;
    originalContext7Key = process.env.CONTEXT7_API_KEY;
    process.env.OPENAI_API_KEY = 'provider-secret';
    process.env.CONTEXT7_API_KEY = 'context7-secret';
    mockedRunTool.mockReset();
    mockedCheckDraft.mockReset();
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiKey;
    if (originalContext7Key === undefined) delete process.env.CONTEXT7_API_KEY;
    else process.env.CONTEXT7_API_KEY = originalContext7Key;
    jest.restoreAllMocks();
  });

  it.each([
    ['blank task', '   '],
    ['oversized task', 'x'.repeat(8001)],
  ])('rejects a %s before launching a worker', async (_label, message) => {
    await expect(new AiderAdapter(config()).propose(directory, [captured('app.cjs', 'module.exports = 1;\n')], message)).rejects.toThrow(/Supply a coding task/);
    expect(mockedRunTool).not.toHaveBeenCalled();
  });

  it('rejects source and documentation that exceed the bounded model context', async () => {
    await expect(new AiderAdapter(config({ contextTokens: 8192 })).propose(
      directory,
      [captured('app.cjs', 'x'.repeat(1000))],
      'fix '.repeat(750),
      'reference '.repeat(800),
    )).rejects.toThrow(/exceed the coding model context budget/);
    expect(mockedRunTool).not.toHaveBeenCalled();
  });

  it('creates a bounded private-snapshot proposal without forwarding provider or unrelated integration credentials', async () => {
    const editable = captured('app.cjs', 'module.exports = () => "broken";\r\n');
    const readOnly = captured('support.cjs', 'module.exports = () => "support";\n');
    mockedRunTool.mockImplementation(async (_command, _args, cwd) => {
      fs.writeFileSync(path.join(cwd, editable.path), 'module.exports = () => "fixed";\n');
      return { stdout: 'CHATBOT_AIDER_FINISHED', stderr: '', exitCode: 0 };
    });
    mockedCheckDraft.mockResolvedValue(checks());

    const result = await new AiderAdapter(config()).propose(
      directory,
      [editable],
      'Fix the return value',
      'Untrusted documentation says to preserve the public API.',
      undefined,
      { readOnly: [readOnly], propertyTests: true },
    );

    const request = JSON.parse(fs.readFileSync(path.join(directory, 'request.json'), 'utf8'));
    const workerEnvironment = mockedRunTool.mock.calls[0][4]!;
    expect(request).toMatchObject({ files: ['app.cjs'], readOnly: ['support.cjs'], think: true, contextTokens: 16384 });
    expect(request.message).toContain('Only edit these files: ["app.cjs"]');
    expect(workerEnvironment).toMatchObject({ OLLAMA_API_BASE: 'http://127.0.0.1:11434', LITELLM_TELEMETRY: 'False', AIDER_ANALYTICS: 'false' });
    expect(workerEnvironment.OPENAI_API_KEY).toBeUndefined();
    expect(workerEnvironment.CONTEXT7_API_KEY).toBeUndefined();
    expect(result).toMatchObject({ provider: 'Aider', model: 'ollama:qwen3:8b', propertyTests: { requested: true, execution: 'not_run' } });
    expect(result.operations).toEqual([expect.objectContaining({ operation: 'modify', path: 'app.cjs', content: 'module.exports = () => "fixed";\r\n', authorized: false })]);
  });

  it('feeds static-check errors into a bounded repair round before returning a valid proposal', async () => {
    const editable = captured('app.cjs', 'module.exports = () => "broken";\n');
    let round = 0;
    mockedRunTool.mockImplementation(async (_command, _args, cwd) => {
      round += 1;
      fs.writeFileSync(path.join(cwd, editable.path), round === 1 ? 'module.exports = () => missingName;\n' : 'module.exports = () => "fixed";\n');
      return { stdout: 'CHATBOT_AIDER_FINISHED', stderr: '', exitCode: 0 };
    });
    mockedCheckDraft.mockResolvedValueOnce(checks(['app.cjs: no-undef missingName'])).mockResolvedValueOnce(checks());

    const result = await new AiderAdapter(config()).propose(directory, [editable], 'Fix the implementation');

    expect(mockedRunTool).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'request.json'), 'utf8')).message).toContain('previous draft failed these static checks');
    expect(result.draftChecks.repairRounds).toBe(1);
    expect(result.operations[0]).toMatchObject({ content: 'module.exports = () => "fixed";\n' });
  });

  it('rejects failed workers, read-only mutations, exhausted budgets, and no-op proposals', async () => {
    const editable = captured('app.cjs', 'module.exports = 1;\n');
    mockedRunTool.mockResolvedValueOnce({ stdout: '', stderr: 'worker exploded', exitCode: 1 });
    await expect(new AiderAdapter(config()).propose(directory, [editable], 'Fix it')).rejects.toThrow(/Aider worker failed/);
    clearWorkspace(directory);

    mockedRunTool.mockResolvedValueOnce({ stdout: 'incomplete worker output', stderr: '', exitCode: 0 });
    await expect(new AiderAdapter(config()).propose(directory, [editable], 'Fix it')).rejects.toThrow(/incomplete worker output/);
    clearWorkspace(directory);

    mockedRunTool.mockImplementationOnce(async (_command, _args, cwd) => {
      fs.writeFileSync(path.join(cwd, 'support.cjs'), 'mutated');
      return { stdout: 'CHATBOT_AIDER_FINISHED', stderr: '', exitCode: 0 };
    });
    await expect(new AiderAdapter(config()).propose(directory, [editable], 'Fix it', undefined, undefined, { readOnly: [captured('support.cjs', 'original')] })).rejects.toThrow(/read-only/);
    clearWorkspace(directory);

    await expect(new AiderAdapter(config({ timeoutMs: 0 })).propose(directory, [editable], 'Fix it')).rejects.toThrow(/exhausted its time budget/);
    clearWorkspace(directory);

    mockedRunTool.mockResolvedValueOnce({ stdout: 'CHATBOT_AIDER_FINISHED', stderr: '', exitCode: 0 });
    mockedCheckDraft.mockResolvedValueOnce(checks());
    await expect(new AiderAdapter(config()).propose(directory, [editable], 'Fix it')).rejects.toThrow(/no file changes/);
    clearWorkspace(directory);

    mockedRunTool.mockImplementationOnce(async (_command, _args, cwd) => {
      const output = path.join(cwd, editable.path);
      fs.rmSync(output);
      fs.mkdirSync(output);
      return { stdout: 'CHATBOT_AIDER_FINISHED', stderr: '', exitCode: 0 };
    });
    mockedCheckDraft.mockResolvedValueOnce(checks());
    await expect(new AiderAdapter(config()).propose(directory, [editable], 'Fix it')).rejects.toThrow(/file boundary/);
  });

  it('rejects static-check failures after three repair rounds and creates new files only from changed output', async () => {
    const created = captured('new-file.cjs', '', false);
    mockedRunTool.mockImplementation(async (_command, _args, cwd) => {
      fs.writeFileSync(path.join(cwd, created.path), 'module.exports = () => true;\n');
      return { stdout: 'CHATBOT_AIDER_FINISHED', stderr: '', exitCode: 0 };
    });
    mockedCheckDraft.mockResolvedValue(checks(['new-file.cjs: invalid draft']));
    await expect(new AiderAdapter(config({ model: 'llama3' })).propose(directory, [created], 'Create a module')).rejects.toThrow(/failed static checks after bounded repair/);
    expect(mockedRunTool).toHaveBeenCalledTimes(3);

    clearWorkspace(directory);
    mockedRunTool.mockClear();
    mockedCheckDraft.mockResolvedValue(checks());
    const result = await new AiderAdapter(config({ model: 'llama3' })).propose(directory, [created], 'Create a module');
    const request = JSON.parse(fs.readFileSync(path.join(directory, 'request.json'), 'utf8'));
    expect(request.think).toBe(false);
    expect(result.operations).toEqual([expect.objectContaining({ operation: 'create', path: 'new-file.cjs', expectedContent: undefined, expectedHash: undefined })]);
    expect(result.propertyTests).toBeUndefined();
  });
});
