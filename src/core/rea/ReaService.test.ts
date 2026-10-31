import fs from 'fs';
import os from 'os';
import path from 'path';
import { ReaService } from './ReaService';
import { ReaConfig, reaConfig } from './ReaConfig';
import { ReaTargets } from './ReaTargets';
import { ReaJobs } from './ReaJobs';
import { handleReaChat } from './ReaChat';
import { runRea } from './ReaProtocol';

describe('REA local analysis lifecycle and target boundaries', () => {
  let root: string, config: ReaConfig;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-rea-'));
    config = { enabled: true, node: process.execPath, entry: process.execPath, dataRoot: path.join(root, 'data'), allowedRoots: [root], timeoutMs: 1000, maxInputBytes: 4096, maxFiles: 10 };
    fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 42;');
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  const successful: typeof runRea = async (_config, target, _operation, directory) => {
    expect(fs.existsSync(target)).toBe(true);
    fs.writeFileSync(path.join(directory, 'evidence.json'), JSON.stringify({ evidence: ['retained-record'] }));
    return [{ tool: 'analyze_javascript_application', evidenceId: 'ev_fixture', result: { limitations: ['Static only'] } }];
  };
  async function finished(service: ReaService, id: string) {
    for (let count = 0; count < 100; count++) {
      const job = service.get(id, 'alice');
      if (!['queued', 'running'].includes(job.status)) return job;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('Analysis did not finish');
  }

  it('retains a snapshot, evidence digest, result and ownership across restarts', async () => {
    const service = new ReaService(config, successful);
    const started = service.start('alice', 'app.js');
    const job = await finished(service, started.id);
    expect(job.status).toBe('completed');
    expect(job.input?.sha256).toMatch(/^[a-f\d]{64}$/);
    expect(job.evidenceSha256).toMatch(/^[a-f\d]{64}$/);
    expect(fs.existsSync(service.evidence(job.id, 'alice'))).toBe(true);
    expect(() => service.get(job.id, 'bob')).toThrow('not found');
    expect(() => service.evidence(job.id, 'bob')).toThrow('not found');
    expect(new ReaService(config).get(job.id, 'alice').evidenceSha256).toBe(job.evidenceSha256);
  });
  it('does not mark a tool response without exported evidence complete', async () => {
    const service = new ReaService(config, async () => []);
    const job = await finished(service, service.start('alice', 'app.js').id);
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/evidence bundle/);
    expect(() => service.evidence(job.id, 'alice')).toThrow();
  });
  it('bounds uploads, scopes their staging root and cleans it up', async () => {
    const service = new ReaService(config, successful);
    const job = service.upload('alice', '../upload.js', Buffer.from('console.log(42)'));
    expect((await finished(service, job.id)).status).toBe('completed');
    expect(config.allowedRoots).toEqual([root]);
    expect(fs.readdirSync(path.join(config.dataRoot, 'uploads'))).toEqual([]);
    expect(() => service.upload('alice', 'large.js', Buffer.alloc(4097))).toThrow(/budget/);
    expect(() => service.upload('alice', 'api_keys.json', Buffer.from('{}'))).toThrow(/private/);
  });
  it('rejects targets outside allowed roots and sensitive files', () => {
    const targets = new ReaTargets(config);
    fs.writeFileSync(path.join(root, 'api_keys.json'), '{}');
    fs.writeFileSync(path.join(root, '.env'), 'fixture');
    fs.writeFileSync(path.join(root, '.env.backup'), 'fixture');
    fs.mkdirSync(path.join(root, '.codex')); fs.writeFileSync(path.join(root, '.codex', 'auth.json'), '{}');
    expect(() => targets.resolve(process.execPath)).toThrow(/outside/);
    expect(() => targets.resolve('api_keys.json')).toThrow(/private/);
    expect(() => targets.resolve('.env')).toThrow(/private/);
    expect(() => targets.resolve('.env.backup')).toThrow(/private/);
    expect(() => targets.resolve('.codex/auth.json')).toThrow(/private/);
    expect(() => targets.resolve('missing.js')).toThrow(/does not exist/);
    expect(() => targets.resolve('\\\\server\\target')).toThrow();
  });
  it('excludes secrets, links and dependencies from directory snapshots', () => {
    const source = path.join(root, 'source'); fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'app.js'), '42');
    fs.writeFileSync(path.join(source, 'credentials.json'), '{}');
    fs.mkdirSync(path.join(source, 'node_modules')); fs.writeFileSync(path.join(source, 'node_modules', 'hidden.js'), '42');
    const destination = path.join(root, 'snapshot');
    const snapshot = new ReaTargets(config).snapshot(source, destination);
    expect(snapshot.files).toBe(1);
    expect(fs.readdirSync(snapshot.path)).toEqual(['app.js']);
    const link = path.join(root, 'junction'); fs.symlinkSync(source, link, process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => new ReaTargets(config).resolve(link)).toThrow(/links/);
  });
  it('limits file size and rejects arbitrary operations and malformed procedure values', () => {
    const service = new ReaService(config, successful);
    fs.writeFileSync(path.join(root, 'large.js'), Buffer.alloc(4097));
    expect(() => service.start('alice', 'large.js')).toThrow(/budget/);
    expect(() => service.start('alice', 'app.js', 'execute')).toThrow(/Unsupported/);
    expect(() => service.start('alice', 'app.js', 'native', {} as string)).toThrow(/procedure/);
    expect(() => service.start('alice', 'app.js', 'pe', 'main')).toThrow(/procedure/);
  });
  it('cancels queued work and preserves cancellation when active work returns', async () => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const runner: typeof runRea = async (...args) => { await pending; return successful(...args); };
    const service = new ReaService(config, runner);
    const first = service.start('alice', 'app.js');
    const second = service.start('alice', 'app.js');
    service.cancel(second.id, 'alice'); service.cancel(first.id, 'alice');
    release();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(service.get(first.id, 'alice').status).toBe('cancelled');
    expect(service.get(second.id, 'alice').status).toBe('cancelled');
  });
  it('times out hung analyses and releases the queue', async () => {
    const service = new ReaService({ ...config, timeoutMs: 20 }, () => new Promise(() => {}));
    const job = await finished(service, service.start('alice', 'app.js').id);
    expect(job.status).toBe('failed'); expect(job.error).toMatch(/time budget/);
    expect(service.status().activeJob).toBeUndefined();
  });
  it('interrupts active and waiting jobs on shutdown and does not resume the queue', async () => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const runner: typeof runRea = async (...args) => { await pending; return successful(...args); };
    const service = new ReaService(config, runner);
    const active = service.start('alice', 'app.js'); const waiting = service.start('alice', 'app.js');
    service.shutdown(); release();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(service.get(active.id, 'alice').status).toBe('interrupted');
    expect(service.get(waiting.id, 'alice').status).toBe('interrupted');
    expect(() => service.start('alice', 'app.js')).toThrow(/unavailable/);
  });
  it('marks interrupted jobs truthfully on startup and blocks disabled analysis', () => {
    const jobs = new ReaJobs(config.dataRoot);
    const id = '12345678-1234-1234-1234-123456789abc';
    jobs.save({ id, owner: 'alice', target: 'app.js', operation: 'auto', status: 'running', createdAt: new Date().toISOString() });
    expect(new ReaService(config).get(id, 'alice').status).toBe('interrupted');
    expect(() => new ReaService({ ...config, enabled: false }).start('alice', 'app.js')).toThrow(/unavailable/);
    expect(() => jobs.directory('../escape')).toThrow(/Invalid/);
  });
  it('never enables REA in hosted deployments', () => {
    const prior = { ...process.env };
    try { process.env.DEPLOYMENT_MODE = 'hosted'; process.env.REA_ENABLED = 'true'; expect(reaConfig(root).enabled).toBe(false); }
    finally { process.env = prior; }
  });
  it('routes explicit chat commands without model claims about unfinished work', async () => {
    const service = new ReaService(config, successful);
    const response = await handleReaChat(service, { userId: 'alice', sessionId: 'chat', message: '/rea analyze "app.js"' });
    expect(response.model).toBe('rea-local'); expect(response.response).toMatch(/running|queued/);
    const id = service.list('alice')[0].id; await finished(service, id);
    const result = await handleReaChat(service, { userId: 'alice', sessionId: 'chat', message: `/rea result ${id}` });
    expect(result.response).toContain('ev_fixture'); expect(result.response).toContain('runtime behavior');
    expect(await handleReaChat(service, { sessionId: 'chat', message: 'Hello' })).toBeUndefined();
  });
});
