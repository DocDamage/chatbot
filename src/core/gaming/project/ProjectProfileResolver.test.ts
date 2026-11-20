import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseUnrealBuildIdentity } from './EngineVersions';
import { EnrolledRuntime } from './ProjectEnrollmentTypes';
import { ProjectProfileResolver } from './ProjectProfileResolver';
import { ProjectRuntimeCatalog } from './ProjectRuntimeCatalog';
import { inspectProjectIdentity } from './ProjectIdentity';

describe('G01 project-version/installation resolution (metadata fixtures)', () => {
  let root: string;
  let resolver: ProjectProfileResolver;
  let runtimes: EnrolledRuntime[];
  const runtime = (changes: Partial<EnrolledRuntime> = {}): EnrolledRuntime => ({ runtimeId: 'fixture-runtime', engine: 'unity',
    exactVersion: '6000.4.5f1', executableSha256: 'a'.repeat(64), evidenceId: 'fixture-evidence', executablePath: 'host-enrolled-fixture',
    associations: [], observedAt: '2026-11-03T00:00:00Z', versionSource: 'file-version-resource', versionOutput: '6000.4.5f1', ...changes });
  const write = (file: string, text: string) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-profile-resolver-'));
    runtimes = [runtime()];
    const catalog = new ProjectRuntimeCatalog(root, () => []);
    jest.spyOn(catalog, 'inventory').mockImplementation(async () => ({ runtimes, blockers: [] }));
    resolver = new ProjectProfileResolver(catalog);
  });
  afterEach(() => {
    expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const resolve = (engine: 'unity' | 'unreal' | 'rpg-maker-mz', selection = {}) => resolver.resolve(inspectProjectIdentity(root, root), engine, selection);
  const unity = () => {
    write('ProjectSettings/ProjectVersion.txt', 'm_EditorVersion: 6000.4.5f1\r\n');
    write('Packages/manifest.json', JSON.stringify({ dependencies: { 'com.fixture.api': '1.0.0' } }));
    write('Packages/packages-lock.json', JSON.stringify({ dependencies: { 'com.fixture.api': { version: '1.0.0', source: 'registry' } } }));
  };
  const unreal = (association: string) => write('Game.uproject', JSON.stringify({ EngineAssociation: association, Plugins: [{ Name: 'FixturePlugin', Enabled: true }] }));

  it('requires the exact Unity suffix and disambiguates duplicate installed releases', async () => {
    unity();
    expect((await resolve('unity')).resolution).toBe('resolved');
    runtimes = [runtime({ exactVersion: '6000.4.5p1' })];
    expect((await resolve('unity')).blockers.map(item => item.code)).toContain('RUNTIME_VERSION_NOT_INSTALLED');
    runtimes = [runtime(), runtime({ runtimeId: 'second-installation' })];
    expect((await resolve('unity')).blockers.map(item => item.code)).toContain('AMBIGUOUS_RUNTIME_SELECTION');
    expect((await resolve('unity', { selectedRuntimeId: 'second-installation' })).runtime?.runtimeId).toBe('second-installation');
  });

  it('binds resolved package versions and rejects paths as compatibility facets', async () => {
    unity();
    const first = await resolve('unity');
    write('Packages/manifest.json', JSON.stringify({ dependencies: { 'com.fixture.api': '1.0.1' } }));
    write('Packages/packages-lock.json', JSON.stringify({ dependencies: { 'com.fixture.api': { version: '1.0.1', source: 'registry' } } }));
    const second = await resolve('unity');
    expect(second.targetId).not.toBe(first.targetId);
    write('Packages/manifest.json', JSON.stringify({ dependencies: { 'com.fixture.api': 'file:../../private-project' } }));
    const local = await resolve('unity');
    expect(local.targetId).toBeNull();
    expect(local.blockers.map(item => item.code)).toContain('LOCAL_PACKAGE_COMPATIBILITY_UNRESOLVED');
  });

  it('keeps a missing package lock unresolved', async () => {
    unity(); fs.unlinkSync(path.join(root, 'Packages/packages-lock.json'));
    expect((await resolve('unity')).blockers.map(item => item.code)).toContain('PACKAGE_LOCK_REQUIRED');
  });

  it('resolves Unreal GUIDs only through inspected host mappings or explicit runtime selection', async () => {
    const guid = '{00000000-0000-0000-0000-000000000001}'; unreal(guid);
    const buildIdentityDigest = parseUnrealBuildIdentity(JSON.stringify({ MajorVersion: 5, MinorVersion: 8, PatchVersion: 3,
      Changelist: 12345, CompatibleChangelist: 12000, IsLicenseeVersion: 0, IsPromotedBuild: 1, BranchName: 'fixture' })).buildIdentityDigest;
    runtimes = [runtime({ engine: 'unreal', exactVersion: '5.8.3', buildIdentityDigest, associations: [guid.slice(1, -1).toLowerCase()] })];
    const mapped = await resolve('unreal');
    expect(mapped).toMatchObject({ resolution: 'resolved', runtime: { buildIdentityDigest } });
    runtimes = [runtime({ engine: 'unreal', exactVersion: '5.8.3', buildIdentityDigest })];
    expect((await resolve('unreal')).blockers.map(item => item.code)).toContain('UNRESOLVED_UNREAL_ASSOCIATION');
    expect((await resolve('unreal', { selectedRuntimeId: 'fixture-runtime' })).resolution).toBe('resolved');
    expect((await resolve('unreal', { selectedRuntimeId: 'fixture-runtime', expectedBuildDigest: 'b'.repeat(64) })).blockers.map(item => item.code)).toContain('UNREAL_BUILD_IDENTITY_MISMATCH');
  });

  it('does not treat an Unreal release association as a full source-build identity', async () => {
    unreal('5.8');
    runtimes = [runtime({ engine: 'unreal', exactVersion: '5.8.3', buildIdentityDigest: 'a'.repeat(64) })];
    expect((await resolve('unreal', { expectedVersion: '5.8.3' })).blockers.map(item => item.code)).toContain('UNREAL_BUILD_BINDING_REQUIRED');
    expect((await resolve('unreal', { selectedRuntimeId: 'fixture-runtime' })).resolution).toBe('resolved');
    unreal('5.7');
    expect((await resolve('unreal', { selectedRuntimeId: 'fixture-runtime' })).blockers.map(item => item.code)).toContain('PROJECT_RUNTIME_VERSION_MISMATCH');
  });

  it('reads MZ metadata statically and reports its unqualified native enrollment honestly', async () => {
    write('Game.rmmzproject', 'RPGMZ 1.0.0');
    write('js/rmmz_core.js', 'Utils.RPGMAKER_NAME = "MZ";\nUtils.RPGMAKER_VERSION = "1.9.0";');
    write('js/plugins.js', 'var $plugins = [{"name":"Fixture","status":true,"parameters":{}}];');
    const profile = await resolve('rpg-maker-mz');
    expect(profile.facts).toMatchObject({ projectVersion: '1.9.0', language: 'javascript' });
    expect(profile.blockers.map(item => item.code)).toContain('MZ_RUNTIME_ENROLLMENT_NOT_QUALIFIED');
    write('js/plugins.js', 'var $plugins = (globalThis.__must_not_execute = true, []);');
    await expect(resolve('rpg-maker-mz')).rejects.toMatchObject({ code: 'UNSUPPORTED_MZ_PLUGIN_SYNTAX' });
    expect((globalThis as any).__must_not_execute).toBeUndefined();
  });
});
