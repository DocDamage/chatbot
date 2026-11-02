import fs from 'fs';
import os from 'os';
import path from 'path';
import { captureFiles, captureNewFiles } from './ToolWorkspace';
import { CodingToolsService } from './CodingToolsService';
import { codingToolConfig } from './CodingToolConfig';
import { runTool } from './ToolProcess';
import { Context7Adapter } from './Context7Adapter';
import { AiderAdapter } from './AiderAdapter';
import { AstGrepAdapter } from './AstGrepAdapter';
import { SerenaAdapter } from './SerenaAdapter';

describe('coding tool source and process boundaries', () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-tool-scope-')); fs.writeFileSync(path.join(root, 'app.ts'), 'export const value = 1;'); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  it('captures bounded source with hashes and rejects credentials, links and traversal', () => {
    fs.writeFileSync(path.join(root, '.env.backup'), 'fixture');
    fs.writeFileSync(path.join(root, 'api_keys.json'), '{}');
    expect(captureFiles(root, ['app.ts'])[0]).toMatchObject({ path: 'app.ts', sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(() => captureFiles(root, ['.env.backup'])).toThrow(/excluded/);
    expect(() => captureFiles(root, ['api_keys.json'])).toThrow(/excluded/);
    expect(() => captureFiles(root, ['../outside.ts'])).toThrow();
    expect(() => captureFiles(root, ['app.ts'], 2)).toThrow(/budget/);
    fs.symlinkSync(root, path.join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => captureFiles(root, ['link/app.ts'])).toThrow(/links/);
  });
  it('admits only explicit new source paths and does not overwrite existing files', () => {
    expect(captureNewFiles(root, ['nested/new.ts'])[0]).toMatchObject({ path: 'nested/new.ts', exists: false });
    expect(() => captureNewFiles(root, ['app.ts'])).toThrow(/already exists/);
    expect(() => captureNewFiles(root, ['../escape.ts'])).toThrow(/outside/);
    expect(() => captureNewFiles(root, ['.aider.conf.yml'])).toThrow(/allowed/);
  });
  it('blocks disabled integrations and unsupported requests before invoking external tools', async () => {
    const service = new CodingToolsService(root, { ...codingToolConfig(), enabled: false });
    await expect(service.propose('alice', { files: ['app.ts'], message: 'Fix value' })).rejects.toThrow(/disabled/);
    expect(() => service.references('alice', { files: ['app.ts'], file: 'missing.ts', symbol: 'value' })).toThrow(/definition file/);
  });
  it('terminates hung subprocesses and supports explicit cancellation', async () => {
    await expect(runTool(process.execPath, ['-e', 'setInterval(()=>{},1000)'], root, 100)).rejects.toMatchObject({ code: 'CODING_TOOL_TIMEOUT' });
    const controller = new AbortController();
    const pending = runTool(process.execPath, ['-e', 'setInterval(()=>{},1000)'], root, 3000, undefined, controller.signal);
    controller.abort(); await expect(pending).rejects.toThrow(/cancelled/);
  });
});

describe('coding job lifecycle and history integration', () => {
  let root: string;
  let service: CodingToolsService;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-lifecycle-'));
    fs.writeFileSync(path.join(root, 'app.ts'), 'export const value = 1;');
    service = new CodingToolsService(root, { ...codingToolConfig(root), enabled: true, timeoutMs: 1000 });
  });
  afterEach(() => { service.shutdown(); jest.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });

  it('records a completed job and exposes owner-scoped history', async () => {
    jest.spyOn(Context7Adapter.prototype, 'query').mockResolvedValue({ provider: 'fixture', content: 'documentation', lookup: false });
    const result = await service.documentation('alice', 'How?', '/fixture/docs');
    expect(service.listJobs('alice')).toEqual([expect.objectContaining({ id: result.runId, status: 'completed', tool: 'context7' })]);
    expect(service.getJob('alice', result.runId).result).toMatchObject({ content: 'documentation' });
    expect(service.listJobs('bob')).toEqual([]);
    expect(() => service.getJob('bob', result.runId)).toThrow(/not found/);
    expect(service.status()).toMatchObject({ enabled: true, aiderBusy: false, workspaceRoot: root });
  });

  it('records failures and refuses anonymous or stopped work', async () => {
    const query = jest.spyOn(Context7Adapter.prototype, 'query').mockRejectedValue(new Error('fixture failure'));
    await expect(service.documentation('', 'How?', '/fixture')).rejects.toThrow(/Authentication/);
    expect(query).not.toHaveBeenCalled();
    await expect(service.documentation('alice', 'How?', '/fixture')).rejects.toThrow('fixture failure');
    expect(service.listJobs('alice')[0]).toMatchObject({ status: 'failed', error: 'fixture failure' });
    service.shutdown();
    expect(service.status().enabled).toBe(false);
    await expect(service.documentation('alice', 'How?', '/fixture')).rejects.toThrow(/disabled/);
  });

  it('propagates cancellation and persists the cancelled status', async () => {
    const controller = new AbortController();
    jest.spyOn(Context7Adapter.prototype, 'query').mockImplementation(async (_query, _library, signal) => {
      expect(signal?.aborted).toBe(true);
      return { provider: 'fixture', lookup: false };
    });
    controller.abort();
    await expect(service.documentation('alice', 'How?', '/fixture', controller.signal)).rejects.toThrow(/cancelled/);
    expect(service.listJobs('alice')[0].status).toBe('cancelled');
  });

  it('cancels active jobs during shutdown', async () => {
    jest.spyOn(Context7Adapter.prototype, 'query').mockImplementation((_query, _library, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new Error('cancelled by signal')), { once: true });
    }));
    const pending = service.documentation('alice', 'How?', '/fixture');
    expect(service.listJobs('alice')[0].status).toBe('running');
    service.shutdown();
    await expect(pending).rejects.toThrow(/cancelled/);
    expect(service.listJobs('alice')[0].status).toBe('cancelled');
  });

  it('enforces the total time budget and records the timeout', async () => {
    jest.useFakeTimers();
    try {
      jest.spyOn(Context7Adapter.prototype, 'query').mockImplementation((_query, _library, signal) => new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }));
      const assertion = expect(service.documentation('alice', 'How?', '/fixture')).rejects.toMatchObject({ code: 'CODING_TOOL_TIMEOUT' });
      jest.advanceTimersByTime(1000);
      await assertion;
      expect(service.listJobs('alice')[0]).toMatchObject({ status: 'cancelled', error: expect.stringContaining('total time budget') });
    } finally { jest.useRealTimers(); }
  });

  it('serializes Aider jobs and releases the worker after completion', async () => {
    let finish!: (value: any) => void;
    jest.spyOn(AiderAdapter.prototype, 'propose').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = service.propose('alice', { files: ['app.ts'], message: 'Explain value', automaticContext: false });
    expect(service.status().aiderBusy).toBe(true);
    await expect(service.propose('alice', { files: [], message: 'second' })).rejects.toThrow(/already using/);
    finish({ provider: 'fixture', operations: [] });
    const result = await pending;
    expect(result.patch.operations).toEqual([]);
    expect(service.status().aiderBusy).toBe(false);
    expect(service.getJob('alice', result.runId).status).toBe('completed');
  });

  it('passes selected source to references and structural searches without applying edits', async () => {
    const references = jest.spyOn(SerenaAdapter.prototype, 'references').mockResolvedValue({ provider: 'fixture' } as any);
    jest.spyOn(AstGrepAdapter.prototype, 'search').mockResolvedValue({ provider: 'fixture', matches: [], operations: [] });
    await service.references('alice', { files: ['app.ts'], file: 'app.ts', symbol: 'value' });
    const result = await service.structural('alice', { files: ['app.ts'], pattern: 'value', language: 'typescript' });
    expect(references).toHaveBeenCalledWith(expect.any(String), [expect.objectContaining({ path: 'app.ts' })], 'app.ts', 'value', expect.any(AbortSignal));
    expect(result.draftChecks).toBeUndefined();
    expect(fs.readFileSync(path.join(root, 'app.ts'), 'utf8')).toBe('export const value = 1;');
  });
});
