import fs from 'node:fs';
import path from 'node:path';
import { NativeEditorBackend } from '../gaming/engine/NativeEditorBackend';
import { EngineAssertion, EngineAssertionReport, EngineExportPreset, EngineExportResult, EngineProfileSnapshot, EngineRuntimeOptions, EngineType } from '../gaming/engine/GameEngineTypes';
import { LocalRuntimeInventory } from './RuntimeDiscovery';
import { runNativeCommand } from './NativeCommandRunner';

function tail(value: string, maximum = 120_000): string {
  return value.length <= maximum ? value : value.slice(-maximum);
}

function quoteForCmd(value: string): string {
  return `"${value.replace(/"/g, '""').replace(/%/g, '%%')}"`;
}

export class InstalledGameEditorBackend implements NativeEditorBackend {
  constructor(private readonly runtimes: LocalRuntimeInventory) {}

  public isAvailable(engine: EngineType): boolean {
    return engine === 'unity' ? Boolean(this.runtimes.unity) : engine === 'unreal' ? Boolean(this.runtimes.unreal) : false;
  }

  public async runScenario(engine: EngineType, projectRoot: string, options: EngineRuntimeOptions, assertions: EngineAssertion[]): Promise<EngineAssertionReport> {
    const startedAt = Date.now();
    if (engine === 'unreal' && assertions.length > 0) {
      return {
        scenarioName: options.scenePath || 'Unreal project validation',
        passed: false,
        durationMs: 0,
        assertions: assertions.map(assertion => ({
          ...assertion,
          actual: 'No trusted Unreal project-side assertion bridge is installed.',
          passed: false
        })),
        capturedLogs: [],
        error: 'UNREAL_ASSERTION_BRIDGE_UNAVAILABLE: install a reviewed project-side automation bridge before running gameplay assertions.'
      };
    }
    const result = engine === 'unity'
      ? await this.runUnity(projectRoot, ['-batchmode', '-nographics', '-quit', ...(options.args || [])], options.maxDurationSeconds)
      : await this.runUnrealCommandlet(projectRoot, [
        '-run=ResavePackages', '-ProjectOnly', '-SkipSave', '-unattended', '-nullrhi', '-nosplash', '-stdout',
        '-FullStdOutLogOutput', ...(options.args || [])
      ], options.maxDurationSeconds);
    const editorLogs = this.collectProjectEditorLogs(projectRoot);
    const evaluated = assertions.map(assertion => ({
      ...assertion,
      actual: 'The installed-editor validation run completed, but this assertion requires a project-side instrumentation bridge.',
      passed: false
    }));
    return {
      scenarioName: options.scenePath || `${engine} project validation`,
      passed: result.exitCode === 0 && evaluated.length === 0,
      durationMs: Date.now() - startedAt,
      assertions: evaluated,
      capturedLogs: `${result.stdout}\n${result.stderr}\n${editorLogs}`.split(/\r?\n/).filter(Boolean).slice(-500),
      error: result.exitCode === 0 && evaluated.length === 0
        ? undefined
        : result.exitCode !== 0
          ? this.executionFailure(engine, result.exitCode, result.stderr || result.stdout || editorLogs)
          : 'One or more assertions require project instrumentation.'
    };
  }

  public async profile(engine: EngineType, projectRoot: string, durationMs = 120_000): Promise<EngineProfileSnapshot> {
    const result = engine === 'unity'
      ? await this.runUnity(projectRoot, ['-batchmode', '-nographics', '-quit'], Math.ceil(durationMs / 1000))
      : await this.runUnrealCommandlet(projectRoot, [
        '-run=ResavePackages', '-ProjectOnly', '-SkipSave', '-unattended', '-nullrhi', '-nosplash', '-stdout', '-FullStdOutLogOutput'
      ], Math.ceil(durationMs / 1000));
    const editorLogs = this.collectProjectEditorLogs(projectRoot);
    if (result.exitCode !== 0) {
      throw new Error(this.executionFailure(engine, result.exitCode, result.stderr || result.stdout || editorLogs));
    }
    throw new Error(
      `${engine.toUpperCase()}_PROFILER_INSTRUMENTATION_UNAVAILABLE: the installed editor completed its validation run, ` +
      'but this project does not expose a trusted profiler bridge. No synthetic metrics were returned.'
    );
  }

  public async exportProject(engine: EngineType, projectRoot: string, preset: EngineExportPreset): Promise<EngineExportResult> {
    const startedAt = Date.now();
    if (engine === 'unity') {
      const output = path.resolve(projectRoot, preset.exportPath);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      const bridgePath = this.ensureUnityBuildBridge(projectRoot);
      const result = await this.runUnity(projectRoot, ['-batchmode', '-nographics', '-quit', '-executeMethod', 'ChatBotHubBuildBridge.Build'], 30 * 60, {
        CHATBOT_UNITY_BUILD_PATH: output,
        CHATBOT_UNITY_BUILD_TARGET: preset.platform
      });
      return this.exportResult(preset, output, result, startedAt, bridgePath);
    }

    const editor = this.requireEditor('unreal');
    const uproject = this.findUproject(projectRoot);
    const runUat = path.resolve(path.dirname(editor), '..', '..', 'Build', 'BatchFiles', 'RunUAT.bat');
    if (!fs.existsSync(runUat)) {
      throw new Error(`Unreal Automation Tool was not found at ${runUat}. Repair or complete the Unreal Engine installation.`);
    }
    const output = path.resolve(projectRoot, preset.exportPath);
    fs.mkdirSync(output, { recursive: true });
    const platform = preset.platform === 'windows' ? 'Win64' : preset.platform;
    const command = [
      quoteForCmd(runUat), 'BuildCookRun', quoteForCmd(`-project=${uproject}`), '-noP4', '-build', '-cook', '-stage', '-pak', '-archive',
      quoteForCmd(`-archivedirectory=${output}`), quoteForCmd(`-platform=${platform}`), '-clientconfig=Development', '-unattended'
    ].join(' ');
    const result = await runNativeCommand(process.env.ComSpec || 'cmd.exe', ['/d', '/v:off', '/s', '/c', command], { timeoutMs: 60 * 60_000 });
    return this.exportResult(preset, output, result, startedAt);
  }

  private async runUnity(projectRoot: string, args: string[], timeoutSeconds = 120, extraEnv: NodeJS.ProcessEnv = {}) {
    return runNativeCommand(this.requireEditor('unity'), ['-projectPath', projectRoot, '-logFile', '-', ...args], {
      timeoutMs: Math.max(30_000, (timeoutSeconds || 120) * 1000), env: { ...process.env, ...extraEnv }
    });
  }

  private async runUnreal(projectRoot: string, args: string[], timeoutSeconds = 120) {
    return runNativeCommand(this.requireEditor('unreal'), [this.findUproject(projectRoot), ...args], {
      timeoutMs: Math.max(30_000, (timeoutSeconds || 120) * 1000)
    });
  }

  private async runUnrealCommandlet(projectRoot: string, args: string[], timeoutSeconds = 120) {
    const editor = this.requireEditor('unreal');
    const commandlet = path.join(path.dirname(editor), 'UnrealEditor-Cmd.exe');
    if (!fs.existsSync(commandlet)) throw new Error(`Unreal commandlet executable was not found at ${commandlet}.`);
    return runNativeCommand(commandlet, [this.findUproject(projectRoot), ...args], {
      timeoutMs: Math.max(30_000, (timeoutSeconds || 120) * 1000)
    });
  }

  private requireEditor(engine: 'unity' | 'unreal'): string {
    const editor = engine === 'unity' ? this.runtimes.unity : this.runtimes.unreal;
    if (!editor) throw new Error(`${engine} editor is not installed or configured.`);
    return editor;
  }

  private findUproject(projectRoot: string): string {
    const descriptor = fs.readdirSync(projectRoot).find(file => file.endsWith('.uproject'));
    if (!descriptor) throw new Error(`No .uproject descriptor found in ${projectRoot}.`);
    return path.join(projectRoot, descriptor);
  }

  private ensureUnityBuildBridge(projectRoot: string): string {
    const bridgePath = path.join(projectRoot, 'Assets', 'Editor', 'ChatBotHubBuildBridge.cs');
    if (fs.existsSync(bridgePath)) return bridgePath;
    fs.mkdirSync(path.dirname(bridgePath), { recursive: true });
    fs.writeFileSync(bridgePath, `using System;\nusing System.Linq;\nusing UnityEditor;\nusing UnityEditor.Build.Reporting;\npublic static class ChatBotHubBuildBridge {\n  public static void Build() {\n    var output = Environment.GetEnvironmentVariable("CHATBOT_UNITY_BUILD_PATH");\n    var platform = (Environment.GetEnvironmentVariable("CHATBOT_UNITY_BUILD_TARGET") ?? "windows").ToLowerInvariant();\n    var target = platform == "linux" ? BuildTarget.StandaloneLinux64 : platform == "macos" ? BuildTarget.StandaloneOSX : BuildTarget.StandaloneWindows64;\n    var scenes = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray();\n    if (scenes.Length == 0) throw new InvalidOperationException("No enabled Unity build scenes were found.");\n    var report = BuildPipeline.BuildPlayer(scenes, output, target, BuildOptions.None);\n    if (report.summary.result != BuildResult.Succeeded) throw new InvalidOperationException("Unity build failed: " + report.summary.result);\n  }\n}\n`, 'utf8');
    return bridgePath;
  }

  private collectProjectEditorLogs(projectRoot: string): string {
    const roots = [path.join(projectRoot, 'Saved', 'Logs'), path.join(projectRoot, 'Saved', 'Crashes')];
    const candidates: Array<{ path: string; modified: number }> = [];
    const visit = (directory: string): void => {
      if (!fs.existsSync(directory)) return;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const candidate = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(candidate);
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.log')) {
          candidates.push({ path: candidate, modified: fs.statSync(candidate).mtimeMs });
        }
      }
    };
    roots.forEach(visit);
    return candidates
      .sort((left, right) => right.modified - left.modified)
      .slice(0, 2)
      .map(candidate => `[editor log: ${candidate.path}]\n${tail(fs.readFileSync(candidate.path, 'utf8'))}`)
      .join('\n');
  }

  private executionFailure(engine: EngineType, exitCode: number, output: string): string {
    const normalized = output.trim();
    if (/No valid Unity Editor license found/i.test(normalized)) {
      return `Unity exited with code ${exitCode}: no valid Unity Editor license is activated on this machine.`;
    }
    const missingShaders = normalized.match(/DirectoryExists\([^\r\n]*Engine\/Shaders[^\r\n]*/i)?.[0];
    if (missingShaders) {
      return `Unreal exited with code ${exitCode}: the installed engine is incomplete because its Engine/Shaders directory is missing.`;
    }
    return `${engine} exited with code ${exitCode}${normalized ? `: ${tail(normalized, 2_000)}` : '.'}`;
  }

  private exportResult(preset: EngineExportPreset, output: string, result: { exitCode: number; stdout: string; stderr: string }, startedAt: number, bridgePath?: string): EngineExportResult {
    const exists = fs.existsSync(output);
    return {
      presetName: preset.name,
      success: result.exitCode === 0 && exists,
      outputArtifactPath: output,
      durationMs: Date.now() - startedAt,
      byteSize: exists && fs.statSync(output).isFile() ? fs.statSync(output).size : 0,
      logs: [...(bridgePath ? [`Unity bridge: ${bridgePath}`] : []), ...`${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter(Boolean).slice(-500)],
      error: result.exitCode === 0 && exists ? undefined : `Editor export failed with code ${result.exitCode}.`
    };
  }
}
