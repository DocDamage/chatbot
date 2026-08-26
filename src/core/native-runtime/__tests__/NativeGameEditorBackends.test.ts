import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runNativeCommand } from '../NativeCommandRunner';
import { InstalledGameEditorBackend } from '../NativeGameEditorBackends';

jest.mock('../NativeCommandRunner', () => ({ runNativeCommand: jest.fn() }));

const mockedRunNativeCommand = jest.mocked(runNativeCommand);

describe('InstalledGameEditorBackend', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-editor-backend-'));
    mockedRunNativeCommand.mockReset();
    mockedRunNativeCommand.mockResolvedValue({ exitCode: 0, stdout: 'Success', stderr: '', durationMs: 12 });
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('uses the terminating Unreal commandlet for a real project validation run', async () => {
    const editor = path.join(root, 'Engine', 'Binaries', 'Win64', 'UnrealEditor.exe');
    const commandlet = path.join(path.dirname(editor), 'UnrealEditor-Cmd.exe');
    fs.mkdirSync(path.dirname(editor), { recursive: true });
    fs.writeFileSync(editor, 'fixture');
    fs.writeFileSync(commandlet, 'fixture');
    fs.writeFileSync(path.join(root, 'Smoke.uproject'), '{}');
    const backend = new InstalledGameEditorBackend({ unreal: editor, ollamaEndpoint: 'http://127.0.0.1:11434' });

    const report = await backend.runScenario('unreal', root, { headless: true }, []);

    expect(report.passed).toBe(true);
    expect(mockedRunNativeCommand).toHaveBeenCalledWith(
      commandlet,
      expect.arrayContaining(['-run=ResavePackages', '-ProjectOnly', '-SkipSave']),
      expect.any(Object)
    );
  });

  it('never substitutes zero-valued metrics when editor instrumentation is absent', async () => {
    const unity = path.join(root, 'Unity.exe');
    fs.writeFileSync(unity, 'fixture');
    const backend = new InstalledGameEditorBackend({ unity, ollamaEndpoint: 'http://127.0.0.1:11434' });

    await expect(backend.profile('unity', root, 1_000)).rejects.toThrow(
      'UNITY_PROFILER_INSTRUMENTATION_UNAVAILABLE'
    );
  });

  it('validates Unreal before profiling and surfaces an editor failure without synthetic metrics', async () => {
    const editor = path.join(root, 'Engine', 'Binaries', 'Win64', 'UnrealEditor.exe');
    const commandlet = path.join(path.dirname(editor), 'UnrealEditor-Cmd.exe');
    fs.mkdirSync(path.dirname(editor), { recursive: true });
    fs.writeFileSync(editor, 'fixture');
    fs.writeFileSync(commandlet, 'fixture');
    fs.writeFileSync(path.join(root, 'Smoke.uproject'), '{}');
    mockedRunNativeCommand.mockResolvedValueOnce({ exitCode: 7, stdout: '', stderr: '', durationMs: 1 });
    const backend = new InstalledGameEditorBackend({ unreal: editor, ollamaEndpoint: 'http://127.0.0.1:11434' });
    await expect(backend.profile('unreal', root, 0)).rejects.toThrow('unreal exited with code 7.');
  });

  it('reports installed editor availability and rejects unsupported or missing editors', async () => {
    const backend = new InstalledGameEditorBackend({ unity: 'Unity.exe', ollamaEndpoint: 'http://127.0.0.1:11434' });
    expect(backend.isAvailable('unity')).toBe(true);
    expect(backend.isAvailable('unreal')).toBe(false);
    expect(backend.isAvailable('custom')).toBe(false);
    await expect(backend.runScenario('unreal', root, {}, [])).rejects.toThrow('unreal editor is not installed');
  });

  it('fails Unreal assertions without launching an untrusted project bridge', async () => {
    const backend = new InstalledGameEditorBackend({ unreal: 'UnrealEditor.exe', ollamaEndpoint: 'http://127.0.0.1:11434' });
    const report = await backend.runScenario('unreal', root, { scenePath: 'Map' }, [
      { type: 'node_exists', target: 'Hero', expected: true }
    ]);
    expect(report).toMatchObject({ passed: false, scenarioName: 'Map', error: expect.stringContaining('UNREAL_ASSERTION_BRIDGE_UNAVAILABLE') });
    expect(report.assertions[0]).toMatchObject({ actual: expect.stringContaining('No trusted'), passed: false });
    expect(mockedRunNativeCommand).not.toHaveBeenCalled();
  });

  it('classifies Unity license errors and generic editor assertion failures from real logs', async () => {
    const unity = path.join(root, 'Unity.exe');
    fs.writeFileSync(unity, 'fixture');
    const backend = new InstalledGameEditorBackend({ unity, ollamaEndpoint: 'http://127.0.0.1:11434' });
    mockedRunNativeCommand.mockResolvedValueOnce({
      exitCode: 198, stdout: '', stderr: 'No valid Unity Editor license found', durationMs: 1
    });
    const license = await backend.runScenario('unity', root, {}, []);
    expect(license.error).toContain('no valid Unity Editor license');

    mockedRunNativeCommand.mockResolvedValueOnce({ exitCode: 0, stdout: 'validated', stderr: '', durationMs: 1 });
    const assertion = await backend.runScenario('unity', root, { args: ['-custom'] }, [
      { type: 'screen_text', target: 'Label', expected: 'Ready' }
    ]);
    expect(assertion).toMatchObject({ passed: false, error: 'One or more assertions require project instrumentation.' });
    expect(assertion.capturedLogs).toContain('validated');

    mockedRunNativeCommand.mockResolvedValueOnce({ exitCode: 4, stdout: '', stderr: 'unknown failure', durationMs: 1 });
    const generic = await backend.runScenario('unity', root, {}, []);
    expect(generic.error).toContain('unity exited with code 4: unknown failure');
  });

  it('reads nested Unreal crash logs and classifies an incomplete shader installation', async () => {
    const editor = path.join(root, 'Engine', 'Binaries', 'Win64', 'UnrealEditor.exe');
    const commandlet = path.join(path.dirname(editor), 'UnrealEditor-Cmd.exe');
    fs.mkdirSync(path.dirname(editor), { recursive: true });
    fs.writeFileSync(editor, 'fixture');
    fs.writeFileSync(commandlet, 'fixture');
    fs.writeFileSync(path.join(root, 'Smoke.uproject'), '{}');
    const crashDir = path.join(root, 'Saved', 'Crashes', 'one');
    fs.mkdirSync(crashDir, { recursive: true });
    fs.writeFileSync(path.join(crashDir, 'Smoke.log'), 'Assertion DirectoryExists(C:/Engine/Shaders missing)');
    mockedRunNativeCommand.mockResolvedValueOnce({ exitCode: 3, stdout: '', stderr: '', durationMs: 1 });
    const backend = new InstalledGameEditorBackend({ unreal: editor, ollamaEndpoint: 'http://127.0.0.1:11434' });
    const report = await backend.runScenario('unreal', root, {}, []);
    expect(report.error).toContain('Engine/Shaders directory is missing');
    expect(report.capturedLogs.join('\n')).toContain('[editor log:');
  });

  it('exports Unity with a generated bridge, reuses it, and reports failed builds honestly', async () => {
    const unity = path.join(root, 'Unity.exe');
    fs.writeFileSync(unity, 'fixture');
    const backend = new InstalledGameEditorBackend({ unity, ollamaEndpoint: 'http://127.0.0.1:11434' });
    mockedRunNativeCommand.mockImplementation(async (_editor, _args, options) => {
      const output = options?.env?.CHATBOT_UNITY_BUILD_PATH;
      if (output) {
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, 'player');
      }
      return { exitCode: 0, stdout: 'built', stderr: '', durationMs: 1 };
    });
    const preset = { name: 'Windows', platform: 'windows' as const, exportPath: 'Build/game.exe', templateVersion: 'installed' };
    const first = await backend.exportProject('unity', root, preset);
    const second = await backend.exportProject('unity', root, preset);
    expect(first).toMatchObject({ success: true, byteSize: 6 });
    expect(second.logs[0]).toContain('Unity bridge:');
    expect(fs.readFileSync(path.join(root, 'Assets', 'Editor', 'ChatBotHubBuildBridge.cs'), 'utf8')).toContain('BuildPipeline.BuildPlayer');

    mockedRunNativeCommand.mockResolvedValueOnce({ exitCode: 2, stdout: '', stderr: 'build failed', durationMs: 1 });
    const failed = await backend.exportProject('unity', root, { ...preset, exportPath: 'Build/missing.exe' });
    expect(failed).toMatchObject({ success: false, byteSize: 0, error: 'Editor export failed with code 2.' });
  });

  it('runs Unreal Automation Tool exports and rejects missing installation components', async () => {
    const editor = path.join(root, 'Engine', 'Binaries', 'Win64', 'UnrealEditor.exe');
    const runUat = path.join(root, 'Engine', 'Build', 'BatchFiles', 'RunUAT.bat');
    fs.mkdirSync(path.dirname(editor), { recursive: true });
    fs.mkdirSync(path.dirname(runUat), { recursive: true });
    fs.writeFileSync(editor, 'fixture');
    fs.writeFileSync(runUat, '@echo off');
    fs.writeFileSync(path.join(root, 'Smoke.uproject'), '{}');
    const backend = new InstalledGameEditorBackend({ unreal: editor, ollamaEndpoint: 'http://127.0.0.1:11434' });
    const output = path.join(root, 'Archive');
    mockedRunNativeCommand.mockImplementationOnce(async () => {
      fs.mkdirSync(output, { recursive: true });
      return { exitCode: 0, stdout: 'packaged', stderr: '', durationMs: 1 };
    });
    const result = await backend.exportProject('unreal', root, {
      name: 'Linux', platform: 'linux', exportPath: 'Archive', templateVersion: 'installed'
    });
    expect(result).toMatchObject({ success: true, outputArtifactPath: output, byteSize: 0 });
    expect(String(mockedRunNativeCommand.mock.calls[0][1][4])).toContain('RunUAT.bat');

    fs.rmSync(runUat);
    await expect(backend.exportProject('unreal', root, {
      name: 'Windows', platform: 'windows', exportPath: 'Archive2', templateVersion: 'installed'
    })).rejects.toThrow('Automation Tool was not found');
  });

  it('rejects Unreal projects without a descriptor or commandlet binary', async () => {
    const editor = path.join(root, 'Engine', 'Binaries', 'Win64', 'UnrealEditor.exe');
    fs.mkdirSync(path.dirname(editor), { recursive: true });
    fs.writeFileSync(editor, 'fixture');
    const backend = new InstalledGameEditorBackend({ unreal: editor, ollamaEndpoint: 'http://127.0.0.1:11434' });
    await expect(backend.runScenario('unreal', root, {}, [])).rejects.toThrow('commandlet executable');
    fs.writeFileSync(path.join(path.dirname(editor), 'UnrealEditor-Cmd.exe'), 'fixture');
    await expect(backend.runScenario('unreal', root, {}, [])).rejects.toThrow('No .uproject descriptor');
  });
});
