import fs from 'fs';
import os from 'os';
import path from 'path';
import { captureFiles, captureNewFiles } from './ToolWorkspace';
import { CodingToolsService } from './CodingToolsService';
import { codingToolConfig } from './CodingToolConfig';
import { runTool } from './ToolProcess';

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
