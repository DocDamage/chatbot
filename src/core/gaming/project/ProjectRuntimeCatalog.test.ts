import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProjectRuntimeCatalog } from './ProjectRuntimeCatalog';
import { RuntimeCandidate } from './ProjectEnrollmentTypes';
import { runNativeCommand } from '../../native-runtime/NativeCommandRunner';

describe('G01 host runtime inspection (fixture processes, not native engine qualification)', () => {
  let root: string;
  let candidates: RuntimeCandidate[];
  let run: jest.MockedFunction<typeof runNativeCommand>;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-runtime-catalog-'));
    const executablePath = path.join(root, 'godot-fixture.exe');
    fs.writeFileSync(executablePath, 'fixture executable bytes');
    candidates = [{ engine: 'godot', executablePath }];
    run = jest.fn().mockResolvedValue({ exitCode: 0, stdout: '4.7.1.stable.official.fixture', stderr: '', durationMs: 1 });
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  const catalog = () => new ProjectRuntimeCatalog(root, () => candidates, run);

  it('binds observed stdout to exact executable bytes and deduplicates physical path aliases', async () => {
    candidates.push({ ...candidates[0], associations: ['alias'] });
    const inventory = await catalog().inventory('godot');
    expect(inventory.runtimes).toHaveLength(1);
    expect(inventory.runtimes[0]).toMatchObject({ exactVersion: '4.7.1.stable.official.fixture', versionSource: 'executable-stdout', associations: ['alias'] });
    expect(inventory.runtimes[0].executableSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(run).toHaveBeenCalledWith(candidates[0].executablePath, ['--version'], expect.objectContaining({ timeoutMs: 10_000 }));
  });
  it('does not merge different installations just because their binary bytes and versions match', async () => {
    const second = path.join(root, 'other.exe'); fs.copyFileSync(candidates[0].executablePath, second);
    candidates.push({ engine: 'godot', executablePath: second });
    const inventory = await catalog().inventory('godot');
    expect(inventory.runtimes).toHaveLength(2);
    expect(new Set(inventory.runtimes.map(item => item.runtimeId)).size).toBe(2);
  });
  it.each(['nonzero', 'malformed', 'changed', 'missing', 'shell'])('cannot enroll %s runtime evidence', async kind => {
    if (kind === 'nonzero') run.mockResolvedValueOnce({ exitCode: 9, stdout: '4.7.1.stable.official.fixture', stderr: '', durationMs: 1 });
    if (kind === 'malformed') run.mockResolvedValueOnce({ exitCode: 0, stdout: 'latest', stderr: '', durationMs: 1 });
    if (kind === 'changed') run.mockImplementationOnce(async () => { fs.appendFileSync(candidates[0].executablePath, 'changed'); return { exitCode: 0, stdout: '4.7.1.stable.official.fixture', stderr: '', durationMs: 1 }; });
    if (kind === 'missing') fs.unlinkSync(candidates[0].executablePath);
    if (kind === 'shell') { candidates[0].executablePath = path.join(root, 'wrapper.cmd'); fs.writeFileSync(candidates[0].executablePath, 'do not execute'); }
    const inventory = await catalog().inventory('godot');
    expect(inventory.runtimes).toEqual([]);
    expect(inventory.blockers.length).toBeGreaterThan(0);
    if (kind === 'shell') expect(run).not.toHaveBeenCalled();
  });

  const windowsIt = process.platform === 'win32' ? it : it.skip;
  windowsIt('reads Unity executable metadata with a fixed command and an environment-bound path', async () => {
    candidates = [{ engine: 'unity', executablePath: candidates[0].executablePath }];
    run.mockResolvedValueOnce({ exitCode: 0, stdout: '6000.4.5f1', stderr: '', durationMs: 1 });
    const result = await catalog().inventory('unity');
    expect(result.runtimes[0]).toMatchObject({ exactVersion: '6000.4.5f1', versionSource: 'file-version-resource' });
    expect(run.mock.calls[0][1]).not.toContain(candidates[0].executablePath);
    expect(run.mock.calls[0][2]?.env?.CHATBOT_PROFILE_EXECUTABLE).toBe(candidates[0].executablePath);
  });
  windowsIt('binds Unreal executable and complete build metadata and rejects their release mismatch', async () => {
    const executablePath = path.join(root, 'Engine/Binaries/Win64/UnrealEditor.exe');
    fs.mkdirSync(path.dirname(executablePath), { recursive: true }); fs.writeFileSync(executablePath, 'fixture');
    fs.mkdirSync(path.join(root, 'Engine/Build'), { recursive: true });
    fs.writeFileSync(path.join(root, 'Engine/Build/Build.version'), JSON.stringify({ MajorVersion: 5, MinorVersion: 8, PatchVersion: 3,
      Changelist: 12345, CompatibleChangelist: 12000, IsLicenseeVersion: 0, IsPromotedBuild: 1, BranchName: '++UE5+Release-5.8' }));
    candidates = [{ engine: 'unreal', executablePath, associations: ['{00000000-0000-0000-0000-000000000001}'] }];
    run.mockResolvedValueOnce({ exitCode: 0, stdout: '++UE5+Release-5.8-CL-12345', stderr: '', durationMs: 1 });
    const result = await catalog().inventory('unreal');
    expect(result.runtimes[0].buildIdentityDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(result.runtimes[0].buildMetadataSha256).toMatch(/^[0-9a-f]{64}$/);
    run.mockResolvedValueOnce({ exitCode: 0, stdout: '5.7.0-other', stderr: '', durationMs: 1 });
    expect((await catalog().inventory('unreal')).runtimes).toEqual([]);
    run.mockResolvedValueOnce({ exitCode: 0, stdout: '++UE5+Release-5.8-CL-99999', stderr: '', durationMs: 1 });
    expect((await catalog().inventory('unreal')).runtimes).toEqual([]);
  });
});
