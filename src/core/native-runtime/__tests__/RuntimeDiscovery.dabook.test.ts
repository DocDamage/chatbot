import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discoverDabookRuntime, resetDabookRuntimeCache } from '../RuntimeDiscovery';
import { CapabilityRegistry } from '../../capabilities/CapabilityRegistry';
import { managedVenvPython } from '../../dabook/DabookConfig';

describe('discoverDabookRuntime', () => {
  let root: string;
  let venvPython: string;

  beforeEach(() => {
    resetDabookRuntimeCache();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'dabook-runtime-'));
    venvPython = managedVenvPython(root);
    fs.mkdirSync(path.dirname(venvPython), { recursive: true });
  });

  afterEach(() => {
    resetDabookRuntimeCache();
    fs.rmSync(root, { recursive: true, force: true });
  });

  const probe = (env: NodeJS.ProcessEnv, run: jest.Mock, now = () => 1_000) =>
    discoverDabookRuntime(root, env, { run: run as any, now });

  it('reports a missing interpreter without spawning anything', () => {
    const run = jest.fn();
    const info = probe({}, run);
    expect(info).toMatchObject({ enabled: false, importable: false });
    expect(info.reason).toContain('npm run setup:dabook');
    expect(run).not.toHaveBeenCalled();
  });

  it('finds an importable interpreter and its version, honouring the enabled flag', () => {
    fs.writeFileSync(venvPython, '');
    const run = jest.fn().mockReturnValue('1.1.0\n');
    const info = probe({ DABOOK_ENABLED: 'true' }, run);
    expect(info).toMatchObject({ enabled: true, importable: true, version: '1.1.0', interpreter: venvPython, source: 'managed-venv' });
    expect(info.reason).toBeUndefined();
    expect(run.mock.calls[0][1]).toEqual(['-c', 'import dabook; print(dabook.__version__)']);
  });

  it('tries the next candidate when an interpreter cannot import dabook', () => {
    const custom = path.join(root, 'custom-python.exe');
    fs.writeFileSync(custom, '');
    fs.writeFileSync(venvPython, '');
    const run = jest.fn().mockImplementation((exe: string) => {
      if (exe === custom) throw new Error('ModuleNotFoundError');
      return '1.1.0';
    });
    const info = probe({ DABOOK_PYTHON: custom }, run);
    expect(info.interpreter).toBe(venvPython);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('says so when an interpreter exists but dabook is not installed in it', () => {
    fs.writeFileSync(venvPython, '');
    const info = probe({}, jest.fn().mockImplementation(() => { throw new Error('No module named dabook'); }));
    expect(info.importable).toBe(false);
    expect(info.reason).toContain('cannot import dabook');
  });

  it('treats empty output as not importable', () => {
    fs.writeFileSync(venvPython, '');
    expect(probe({}, jest.fn().mockReturnValue('  \n')).importable).toBe(false);
  });

  it('caches for a minute, then re-probes; a config change busts the cache', () => {
    fs.writeFileSync(venvPython, '');
    const run = jest.fn().mockReturnValue('1.1.0');
    let t = 1_000;
    probe({}, run, () => t);
    probe({}, run, () => t + 30_000);
    expect(run).toHaveBeenCalledTimes(1);
    probe({}, run, () => t + 61_000);
    expect(run).toHaveBeenCalledTimes(2);
    probe({ DABOOK_ENABLED: 'true' }, run, () => t + 61_000);
    expect(run).toHaveBeenCalledTimes(3);
  });
});

describe('structured_pdf_ingestion capability', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    resetDabookRuntimeCache();
  });

  const capability = () => CapabilityRegistry.getInstance().getCapabilities('development', 'developer').find(c => c.id === 'structured_pdf_ingestion')!;

  it('appears in the hub with an honest maturity and setup guidance when DABOOK is not installed', () => {
    delete process.env.DABOOK_ENABLED;
    process.env.DABOOK_PYTHON = path.join(os.tmpdir(), 'definitely-not-here', 'python.exe');
    resetDabookRuntimeCache();
    const item = capability();
    expect(item).toMatchObject({
      maturity: 'LOCAL_ONLY_EXPERIMENTAL',
      localOnly: true,
      apiBasePath: '/api/knowledge-base/dabook'
    });
    // The repo's managed venv may or may not exist on this machine; either way it must not claim health it did not verify.
    if (item.healthState !== 'healthy') {
      expect(item.section).toBe('needs_setup');
      expect(item.diagnostics?.remediationSteps.join(' ')).toContain('npm run setup:dabook');
    }
  });

  it('is blocked by policy in the hosted profile', () => {
    const item = CapabilityRegistry.getInstance().getCapabilities('hosted', 'developer').find(c => c.id === 'structured_pdf_ingestion')!;
    expect(item.section).toBe('disabled_by_policy');
    expect(item.healthState).toBe('disabled');
  });
});
