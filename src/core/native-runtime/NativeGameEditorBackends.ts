import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NativeEditorBackend } from '../gaming/engine/NativeEditorBackend';
import { EngineAssertion, EngineAssertionReport, EngineExportPreset, EngineExportResult, EngineProfileSnapshot, EngineRuntimeOptions, EngineType } from '../gaming/engine/GameEngineTypes';
import { LocalRuntimeInventory } from './RuntimeDiscovery';
import { runNativeCommand } from './NativeCommandRunner';
import { UNITY_INSTRUMENTATION_BRIDGE, UNREAL_INSTRUMENTATION_BRIDGE } from './GameEditorInstrumentationSources';

interface InstrumentationAssertionResult {
  actual?: unknown;
  actualJson?: string;
  passed: boolean;
}

interface InstrumentationResult {
  mode: 'scenario' | 'profile' | 'error';
  scenarioName?: string;
  durationMs?: number;
  assertions?: InstrumentationAssertionResult[];
  profile?: EngineProfileSnapshot;
  error?: string;
}

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
    if (assertions.length > 0 && (engine === 'unity' || engine === 'unreal')) {
      const instrumented = await this.runInstrumentation(engine, projectRoot, 'scenario', options, assertions);
      const evaluated = assertions.map((assertion, index) => {
        const result = instrumented.output.assertions?.[index];
        return {
          ...assertion,
          actual: result?.actualJson === undefined ? result?.actual : this.parseJsonValue(result.actualJson),
          passed: result?.passed === true
        };
      });
      return {
        scenarioName: instrumented.output.scenarioName || options.scenePath || `${engine} gameplay scenario`,
        passed: instrumented.output.mode === 'scenario' && evaluated.every(assertion => assertion.passed),
        durationMs: instrumented.output.durationMs ?? Date.now() - startedAt,
        assertions: evaluated,
        capturedLogs: instrumented.logs,
        error: instrumented.output.error
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
    if (engine !== 'unity' && engine !== 'unreal') throw new Error(`${engine} editor is not supported by the installed editor backend.`);
    if (engine === 'unreal') return this.profileUnrealCsv(projectRoot, durationMs);
    const instrumented = await this.runInstrumentation(engine, projectRoot, 'profile', { maxDurationSeconds: Math.ceil(durationMs / 1000) + 120 }, [], durationMs);
    if (instrumented.output.mode !== 'profile' || !instrumented.output.profile) {
      throw new Error(instrumented.output.error || `${engine.toUpperCase()}_PROFILER_INSTRUMENTATION_FAILED: the project-side bridge returned no profile.`);
    }
    return instrumented.output.profile;
  }

  private async profileUnrealCsv(projectRoot: string, durationMs: number): Promise<EngineProfileSnapshot> {
    const editor = this.requireEditor('unreal');
    const engineRoot = path.resolve(path.dirname(editor), '..', '..');
    const buildVersionPath = path.join(engineRoot, 'Build', 'Build.version');
    let engineVersion = path.basename(path.dirname(engineRoot)).match(/UE_(\d+\.\d+)/i)?.[1];
    if (fs.existsSync(buildVersionPath)) {
      try {
        const version = JSON.parse(fs.readFileSync(buildVersionPath, 'utf8')) as { MajorVersion?: number; MinorVersion?: number };
        if (Number.isFinite(version.MajorVersion) && Number.isFinite(version.MinorVersion)) {
          engineVersion = `${version.MajorVersion}.${version.MinorVersion}`;
        }
      } catch {
        // Fall through to the installation-directory version when Build.version is malformed.
      }
    }
    const csvDirectories = [path.join(projectRoot, 'Saved', 'Profiling', 'CSV')];
    if (process.platform === 'win32' && engineVersion) {
      csvDirectories.push(path.join(os.homedir(), 'AppData', 'Local', 'UnrealEngine', engineVersion, 'Saved', 'Profiling', 'CSV'));
    }
    const before = new Set(this.listCsvFiles(csvDirectories).map(candidate => `${candidate.path}|${candidate.modified}|${candidate.size}`));
    const startedAt = Date.now();
    const captureFrames = Math.max(120, Math.min(3_600, Math.ceil(Math.max(durationMs, 1_000) / (1000 / 60))));
    const result = await this.runUnrealCommandlet(projectRoot, [
      '-game', '-nullrhi', '-unattended', '-nosplash', '-stdout', '-FullStdOutLogOutput',
      `-csvCaptureFrames=${captureFrames}`, '-ExitAfterCsvProfiling', '-csvCompression=0'
    ], Math.ceil(durationMs / 1000) + 180);
    if (result.exitCode !== 0) throw new Error(this.executionFailure('unreal', result.exitCode, result.stderr || result.stdout));
    const candidate = this.listCsvFiles(csvDirectories)
      .filter(file => file.modified >= startedAt - 1_000 && !before.has(`${file.path}|${file.modified}|${file.size}`))
      .sort((left, right) => right.modified - left.modified)[0];
    if (!candidate) {
      throw new Error(`UNREAL_CSV_PROFILER_FAILED: no new CSV capture was found under ${csvDirectories.join(' or ')}.`);
    }
    return this.parseUnrealCsvProfile(candidate.path);
  }

  private listCsvFiles(directories: string[]): Array<{ path: string; modified: number; size: number }> {
    const files: Array<{ path: string; modified: number; size: number }> = [];
    for (const directory of directories) {
      if (!fs.existsSync(directory)) continue;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.csv')) continue;
        const candidatePath = path.join(directory, entry.name);
        const stat = fs.statSync(candidatePath);
        files.push({ path: candidatePath, modified: stat.mtimeMs, size: stat.size });
      }
    }
    return files;
  }

  private parseUnrealCsvProfile(csvPath: string): EngineProfileSnapshot {
    const lines = fs.readFileSync(csvPath, 'utf8').split(/\r\n|\n|\r/).filter(Boolean);
    const headerIndex = lines.findIndex(line => line.startsWith('EVENTS,'));
    if (headerIndex < 0) throw new Error(`UNREAL_CSV_PROFILER_FAILED: ${csvPath} has no CSV header.`);
    const headers = this.parseCsvLine(lines[headerIndex]);
    const column = (name: string): number => headers.indexOf(name);
    const frameIndex = column('FrameTime');
    const memoryIndex = column('PhysicalUsedMB');
    const actorIndex = column('ActorCount/TotalActorCount');
    const drawIndex = column('RHI/DrawCalls');
    if (frameIndex < 0 || memoryIndex < 0 || actorIndex < 0) {
      throw new Error(`UNREAL_CSV_PROFILER_FAILED: ${csvPath} is missing required FrameTime, PhysicalUsedMB, or actor-count columns.`);
    }
    const parsedRows = lines.slice(headerIndex + 1)
      .filter(line => !line.startsWith('EVENTS,'))
      .map(line => this.parseCsvLine(line))
      .filter(values => Number.isFinite(Number(values[frameIndex])) && Number(values[frameIndex]) > 0);
    const steadyRows = parsedRows.filter(values => Number(values[frameIndex]) < 1_000).slice(-60);
    if (steadyRows.length === 0) throw new Error(`UNREAL_CSV_PROFILER_FAILED: ${csvPath} contains no usable gameplay frames.`);
    const average = (index: number): number | undefined => {
      if (index < 0) return undefined;
      const values = steadyRows.map(row => Number(row[index])).filter(Number.isFinite);
      return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
    };
    const frameTimeMs = average(frameIndex) as number;
    return {
      timestamp: fs.statSync(csvPath).mtime.toISOString(),
      fps: 1000 / frameTimeMs,
      frameTimeMs,
      drawCalls: average(drawIndex),
      nodeCount: Math.round(average(actorIndex) || 0),
      memoryMb: average(memoryIndex) || 0
    };
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === ',' && !quoted) {
        values.push(value);
        value = '';
      } else {
        value += character;
      }
    }
    values.push(value);
    return values;
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

  private async runUnrealCommandlet(projectRoot: string, args: string[], timeoutSeconds = 120, extraEnv: NodeJS.ProcessEnv = {}) {
    const editor = this.requireEditor('unreal');
    const commandlet = path.join(path.dirname(editor), 'UnrealEditor-Cmd.exe');
    if (!fs.existsSync(commandlet)) throw new Error(`Unreal commandlet executable was not found at ${commandlet}.`);
    return runNativeCommand(commandlet, [this.findUproject(projectRoot), ...args], {
      timeoutMs: Math.max(30_000, (timeoutSeconds || 120) * 1000), env: { ...process.env, ...extraEnv }
    });
  }

  private async runInstrumentation(
    engine: 'unity' | 'unreal',
    projectRoot: string,
    mode: 'scenario' | 'profile',
    options: EngineRuntimeOptions,
    assertions: EngineAssertion[],
    durationMs = 1_000
  ): Promise<{ output: InstrumentationResult; logs: string[] }> {
    const instrumentationRoot = path.join(projectRoot, '.chatbot-instrumentation');
    fs.mkdirSync(instrumentationRoot, { recursive: true });
    const runId = `${process.pid}-${Date.now()}`;
    const requestPath = path.join(instrumentationRoot, `request-${runId}.json`);
    const resultPath = path.join(instrumentationRoot, `result-${runId}.json`);
    const request = {
      mode,
      scenePath: options.scenePath || '',
      durationMs,
      assertions: assertions.map(assertion => ({ ...assertion, expectedJson: JSON.stringify(assertion.expected) }))
    };
    fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');
    const bridgePath = engine === 'unity'
      ? this.ensureBridge(path.join(projectRoot, 'Assets', 'Editor', 'ChatBotHubInstrumentationBridge.cs'), UNITY_INSTRUMENTATION_BRIDGE)
      : this.ensureBridge(path.join(projectRoot, 'Content', 'Python', 'chatbot_hub_instrumentation.py'), UNREAL_INSTRUMENTATION_BRIDGE);
    const instrumentationEnv = {
      ...process.env,
      CHATBOT_ENGINE_REQUEST: requestPath,
      CHATBOT_ENGINE_RESULT: resultPath
    };
    const timeoutSeconds = Math.max(options.maxDurationSeconds || 0, Math.ceil(durationMs / 1000) + 120);
    const result = engine === 'unity'
      ? await this.runUnity(projectRoot, ['-batchmode', '-nographics', '-executeMethod', 'ChatBotHubInstrumentationBridge.Run', ...(options.args || [])], timeoutSeconds, instrumentationEnv)
      : await this.runUnrealCommandlet(projectRoot, [
        `-ExecutePythonScript=${bridgePath.replaceAll('\\', '/')}`, '-unattended', '-nullrhi', '-nosplash', '-stdout', '-FullStdOutLogOutput', ...(options.args || [])
      ], timeoutSeconds, instrumentationEnv);
    const editorLogs = this.collectProjectEditorLogs(projectRoot);
    const logs = [`Instrumentation bridge: ${bridgePath}`, ...`${result.stdout}\n${result.stderr}\n${editorLogs}`.split(/\r?\n/).filter(Boolean).slice(-500)];
    if (!fs.existsSync(resultPath)) {
      throw new Error(this.executionFailure(engine, result.exitCode, result.stderr || result.stdout || editorLogs || 'Instrumentation bridge produced no result file.'));
    }
    const output = JSON.parse(fs.readFileSync(resultPath, 'utf8')) as InstrumentationResult;
    if (output.mode === 'error') throw new Error(`${engine.toUpperCase()}_INSTRUMENTATION_FAILED: ${output.error || 'unknown bridge error'}`);
    if (result.exitCode !== 0 && !(mode === 'scenario' && output.assertions?.some(assertion => !assertion.passed))) {
      throw new Error(this.executionFailure(engine, result.exitCode, result.stderr || result.stdout || editorLogs));
    }
    return { output, logs };
  }

  private ensureBridge(bridgePath: string, source: string): string {
    fs.mkdirSync(path.dirname(bridgePath), { recursive: true });
    if (!fs.existsSync(bridgePath) || fs.readFileSync(bridgePath, 'utf8') !== source) fs.writeFileSync(bridgePath, source, 'utf8');
    return bridgePath;
  }

  private parseJsonValue(value: string): unknown {
    try { return JSON.parse(value); } catch { return value; }
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
