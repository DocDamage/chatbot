import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runNativeCommand } from '../../native-runtime/NativeCommandRunner';
import { discoverGameRuntimeCandidates } from '../../native-runtime/GameRuntimeCandidates';
import { digestJson } from '../engine/CanonicalJson';
import { EngineKind, parseGodotExecutableVersion, parseUnityExecutableVersion, parseUnrealBuildIdentity, validateUnrealExecutableVersion } from './EngineVersions';
import { EnrolledRuntime, RuntimeCandidate, RuntimeInventory } from './ProjectEnrollmentTypes';

export async function executableHash(executable: string): Promise<string> {
  const stat = fs.statSync(executable);
  if (!stat.isFile() || stat.size === 0 || stat.size > 512 * 1024 * 1024) throw new Error('INVALID_RUNTIME_EXECUTABLE');
  const hash = crypto.createHash('sha256');
  for await (const bytes of fs.createReadStream(executable)) hash.update(bytes);
  return hash.digest('hex');
}

/** Only server-discovered paths are accepted. HTTP callers select opaque runtime IDs. */
export class ProjectRuntimeCatalog {
  constructor(private readonly workspaceRoot: string,
    private readonly candidates: () => RuntimeCandidate[] = () => discoverGameRuntimeCandidates(workspaceRoot),
    private readonly run: typeof runNativeCommand = runNativeCommand) {}

  public async inventory(engine: EngineKind): Promise<RuntimeInventory> {
    const result: RuntimeInventory = { runtimes: [], blockers: [] };
    if (engine === 'rpg-maker-mz') return result;
    const merged = new Map<string, RuntimeCandidate>();
    for (const candidate of this.candidates().filter(item => item.engine === engine)) {
      try {
        const real = fs.realpathSync.native(candidate.executablePath);
        const key = process.platform === 'win32' ? real.toLowerCase() : real;
        const existing = merged.get(key);
        merged.set(key, { ...candidate, executablePath: real, associations: [...new Set([...(existing?.associations || []), ...(candidate.associations || [])])].sort() });
      } catch { result.blockers.push({ code: 'RUNTIME_PATH_MISSING', message: `An installed ${engine} candidate no longer exists.` }); }
    }
    if (merged.size > 32) return { runtimes: [], blockers: [{ code: 'RUNTIME_INVENTORY_LIMIT', message: 'More than 32 installations require a narrower server-owned inventory.' }] };
    for (const candidate of merged.values()) {
      try { result.runtimes.push(await this.inspect(candidate)); }
      catch (error) { result.blockers.push({ code: 'RUNTIME_INSPECTION_FAILED', message: `${engine}: ${error instanceof Error ? error.message : String(error)}` }); }
    }
    result.runtimes.sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));
    return result;
  }

  private async inspect(candidate: RuntimeCandidate): Promise<EnrolledRuntime> {
    const executablePath = candidate.executablePath;
    if (/\.(?:cmd|bat|ps1|sh)$/i.test(executablePath)) throw new Error('SHELL_RUNTIME_NOT_ALLOWED');
    const executableSha256 = await executableHash(executablePath);
    let exactVersion: string;
    let versionOutput: string;
    let buildMetadata: string | undefined;
    let buildIdentityDigest: string | undefined;
    let buildMetadataPath: string | undefined;
    let buildMetadataSha256: string | undefined;
    const versionSource = candidate.engine === 'godot' ? 'executable-stdout' : 'file-version-resource';
    if (candidate.engine === 'godot') {
      const probe = await this.run(executablePath, ['--version'], { timeoutMs: 10_000, cwd: this.workspaceRoot });
      if (probe.exitCode !== 0) throw new Error(`VERSION_PROBE_EXIT_${probe.exitCode}`);
      exactVersion = parseGodotExecutableVersion(probe.stdout);
      versionOutput = probe.stdout.trim();
    } else {
      if (process.platform !== 'win32') throw new Error('FILE_VERSION_PROBE_REQUIRES_WINDOWS');
      // Fixed read-only metadata command. The executable path is an environment value, never shell code.
      const probe = await this.run(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
        ['-NoProfile', '-NonInteractive', '-Command', '[Diagnostics.FileVersionInfo]::GetVersionInfo($env:CHATBOT_PROFILE_EXECUTABLE).ProductVersion'],
        { timeoutMs: 10_000, env: { ...process.env, CHATBOT_PROFILE_EXECUTABLE: executablePath } });
      if (probe.exitCode !== 0) throw new Error(`FILE_VERSION_PROBE_EXIT_${probe.exitCode}`);
      versionOutput = probe.stdout.trim();
      if (candidate.engine === 'unity') {
        exactVersion = parseUnityExecutableVersion(versionOutput);
        buildIdentityDigest = digestJson('unity-runtime-build:v1', { productVersion: versionOutput });
      } else {
        const engineRoot = path.resolve(path.dirname(executablePath), '..', '..');
        const metadataPath = path.join(engineRoot, 'Build', 'Build.version');
        if (fs.statSync(metadataPath).size > 1_048_576) throw new Error('UNREAL_BUILD_METADATA_LIMIT');
        const bytes = fs.readFileSync(metadataPath);
        if (bytes.includes(0) || !Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes)) throw new Error('UNREAL_BUILD_METADATA_ENCODING');
        const build = parseUnrealBuildIdentity(bytes.toString('utf8').replace(/^\uFEFF/, ''));
        validateUnrealExecutableVersion(versionOutput, build);
        exactVersion = build.releaseVersion;
        buildIdentityDigest = build.buildIdentityDigest;
        buildMetadata = build.canonicalBuildMetadata;
        buildMetadataPath = metadataPath;
        buildMetadataSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
      }
    }
    if (await executableHash(executablePath) !== executableSha256) throw new Error('RUNTIME_CHANGED_DURING_PROBE');
    const runtimeId = digestJson('enrolled-runtime:v1', { engine: candidate.engine, executablePath, executableSha256, exactVersion, buildIdentityDigest: buildIdentityDigest || null });
    const evidenceId = digestJson('runtime-evidence:v1', { runtimeId, versionSource, versionOutput, buildMetadata: buildMetadata || null });
    return { runtimeId, engine: candidate.engine, exactVersion, executableSha256, executablePath, evidenceId,
      associations: candidate.associations || [], observedAt: new Date().toISOString(), versionSource, versionOutput,
      ...(buildIdentityDigest ? { buildIdentityDigest } : {}),
      ...(buildMetadata ? { buildMetadata, buildMetadataPath, buildMetadataSha256 } : {}) };
  }
}
