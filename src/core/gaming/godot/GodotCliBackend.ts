import fs from 'node:fs';
import path from 'node:path';
import { EngineAssertion, EngineAssertionReport, EngineExportPreset, EngineExportResult, EngineProfileSnapshot, EngineRuntimeOptions } from '../engine/GameEngineTypes';
import { GodotExportBackend } from './GodotAssetPipeline';
import { GodotRuntimeBackend } from './GodotRuntimeRunner';
import { runNativeCommand } from '../../native-runtime/NativeCommandRunner';
import { evaluateScenarioPayload, scenarioBinding, validateAssertions } from '../engine/NativeScenarioEvidence';

function parseTaggedJson<T>(output: string, tag: string): T | undefined {
  const line = output.split(/\r?\n/).find(value => value.startsWith(tag));
  return line ? JSON.parse(line.slice(tag.length)) as T : undefined;
}

export class GodotCliBackend implements GodotRuntimeBackend, GodotExportBackend {
  constructor(private readonly godotPath: string, private readonly workspaceRoot: string) {}

  public async runScenario(projectRoot: string, options: EngineRuntimeOptions, assertions: EngineAssertion[]): Promise<EngineAssertionReport> {
    const startedAt = Date.now();
    validateAssertions(assertions);
    const evidence = scenarioBinding('godot', projectRoot, options.scenePath || '', assertions, options.scopeDigest);
    const result = await runNativeCommand(this.godotPath, [
      '--headless', '--path', projectRoot, '--script', path.join(this.workspaceRoot, 'scripts', 'native', 'godot_runtime_probe.gd')
    ], {
      timeoutMs: Math.max(10_000, (options.maxDurationSeconds || 60) * 1000),
      env: {
        ...process.env,
        CHATBOT_GODOT_SCENE: options.scenePath || '',
        CHATBOT_GODOT_ASSERTIONS: JSON.stringify(assertions),
        CHATBOT_GODOT_EVIDENCE: JSON.stringify(evidence)
      }
    });
    let evaluated: EngineAssertion[] = assertions.map(assertion => ({ ...assertion, passed: false }));
    let error: string | undefined;
    try {
      // Exactly one stdout report is accepted. Editor logs and stderr are diagnostics only.
      const lines = result.stdout.split(/\r?\n/).filter(line => line.startsWith('CHATBOT_RUNTIME_JSON:'));
      if (lines.length !== 1) throw new Error('Godot probe must produce exactly one assertion report.');
      const payload = JSON.parse(lines[0].slice('CHATBOT_RUNTIME_JSON:'.length)) as unknown;
      evaluated = evaluateScenarioPayload(payload, evidence, assertions);
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure);
    }
    if (result.exitCode !== 0) error = `Godot exited with code ${result.exitCode}. ${error || ''}`.trim();
    if (error) evaluated = evaluated.map(assertion => ({ ...assertion, passed: false }));
    return {
      checkKind: 'scene_observation',
      evidence,
      scenarioName: options.scenePath || 'Godot main scene',
      passed: !error && evaluated.length > 0 && evaluated.every(assertion => assertion.passed === true),
      durationMs: Date.now() - startedAt,
      assertions: evaluated,
      capturedLogs: `${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter(Boolean).slice(-500),
      error
    };
  }

  public async profileProject(projectRoot: string): Promise<EngineProfileSnapshot> {
    const result = await runNativeCommand(this.godotPath, [
      '--headless', '--path', projectRoot, '--script', path.join(this.workspaceRoot, 'scripts', 'native', 'godot_profile_probe.gd')
    ], { timeoutMs: 120_000 });
    const payload = parseTaggedJson<Omit<EngineProfileSnapshot, 'timestamp'>>(`${result.stdout}\n${result.stderr}`, 'CHATBOT_PROFILE_JSON:');
    if (result.exitCode !== 0 || !payload) throw new Error(`Godot profiler probe failed: ${result.stderr.trim()}`);
    return { timestamp: new Date().toISOString(), ...payload };
  }

  public async exportProject(projectRoot: string, preset: EngineExportPreset, outputDirectory: string): Promise<EngineExportResult> {
    const startedAt = Date.now();
    const extension = preset.platform === 'windows' ? '.exe' : preset.platform === 'web' ? '.zip' : '';
    const requestedName = path.basename(preset.exportPath || preset.name).replace(/\.[^.]+$/, '');
    const outputArtifactPath = path.join(outputDirectory, `${requestedName}${extension}`);
    const result = await runNativeCommand(this.godotPath, [
      '--headless', '--path', projectRoot, '--export-release', preset.name, outputArtifactPath
    ], { timeoutMs: 30 * 60_000 });
    return {
      presetName: preset.name,
      success: result.exitCode === 0 && fs.existsSync(outputArtifactPath),
      outputArtifactPath,
      durationMs: Date.now() - startedAt,
      byteSize: fs.existsSync(outputArtifactPath) ? fs.statSync(outputArtifactPath).size : 0,
      logs: `${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter(Boolean).slice(-500),
      error: result.exitCode === 0 ? undefined : `Godot export exited with code ${result.exitCode}.`
    };
  }
}
