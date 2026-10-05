import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveDabookConfig } from '../dabook/DabookConfig';

function commandPath(name: string): string | undefined {
  try {
    const locator = process.platform === 'win32' ? 'where.exe' : 'which';
    const output = execFileSync(locator, [name], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return output.split(/\r?\n/).map(value => value.trim()).find(Boolean);
  } catch {
    return undefined;
  }
}

function firstExisting(candidates: Array<string | undefined>): string | undefined {
  const candidate = candidates.find(value => value && fs.existsSync(value));
  if (!candidate || path.extname(candidate).toLowerCase() !== '.cmd') return candidate;
  try {
    const match = fs.readFileSync(candidate, 'utf8').match(/"([^"]+\.exe)"/i);
    if (!match) return candidate;
    const expanded = match[1].replace(/%([^%]+)%/g, (_value, name: string) => process.env[name] || '');
    return fs.existsSync(expanded) ? expanded : candidate;
  } catch {
    return candidate;
  }
}

export function isCompleteUnrealEditor(editor: string | undefined): editor is string {
  if (!editor || !fs.existsSync(editor)) return false;
  const engineRoot = path.resolve(path.dirname(editor), '..', '..');
  return fs.existsSync(path.join(engineRoot, 'Shaders'))
    && fs.existsSync(path.join(engineRoot, 'Content'))
    && fs.existsSync(path.join(engineRoot, 'Build', 'BatchFiles', 'RunUAT.bat'));
}

function discoverUnrealEditor(programFiles: string): string | undefined {
  const roots = [path.join(programFiles, 'Epic Games'), 'D:\\Unreal'];
  const candidates = roots.flatMap(root => fs.existsSync(root)
    ? fs.readdirSync(root, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^UE_/i.test(entry.name))
      .map(entry => path.join(root, entry.name, 'Engine', 'Binaries', 'Win64', 'UnrealEditor.exe'))
    : []);
  const configured = process.env.UNREAL_EDITOR_PATH;
  return [configured, ...candidates.sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))]
    .find(isCompleteUnrealEditor);
}

export interface LocalRuntimeInventory {
  python?: string;
  ffmpeg?: string;
  ffprobe?: string;
  demucs?: string;
  godot?: string;
  unity?: string;
  unreal?: string;
  powershell?: string;
  ollamaEndpoint: string;
}

export function discoverLocalRuntimes(workspaceRoot = process.cwd()): LocalRuntimeInventory {
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const unityHubRoot = path.join(programFiles, 'Unity', 'Hub', 'Editor');
  const unity = fs.existsSync(unityHubRoot)
    ? fs.readdirSync(unityHubRoot).sort().reverse()
      .map(version => path.join(unityHubRoot, version, 'Editor', 'Unity.exe'))
      .find(candidate => fs.existsSync(candidate))
    : undefined;
  const unreal = discoverUnrealEditor(programFiles);

  return {
    python: firstExisting([
      process.env.CHATBOT_NATIVE_PYTHON,
      path.join(workspaceRoot, 'data', 'native-runtime', 'python', 'Scripts', 'python.exe'),
      commandPath('python')
    ]),
    ffmpeg: firstExisting([process.env.FFMPEG_PATH, commandPath('ffmpeg')]),
    ffprobe: firstExisting([process.env.FFPROBE_PATH, commandPath('ffprobe')]),
    demucs: firstExisting([
      process.env.DEMUCS_PATH,
      path.join(workspaceRoot, 'data', 'native-runtime', 'python', 'Scripts', 'demucs.exe'),
      commandPath('demucs')
    ]),
    godot: firstExisting([process.env.GODOT_PATH, commandPath('godot'), commandPath('godot4')]),
    unity: firstExisting([process.env.UNITY_EDITOR_PATH, unity]),
    unreal,
    powershell: firstExisting([commandPath('powershell.exe'), commandPath('pwsh.exe')]),
    ollamaEndpoint: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
  };
}

export interface DabookRuntimeInfo {
  /** DABOOK_ENABLED=true */
  enabled: boolean;
  /** First configured interpreter that can import dabook. */
  interpreter?: string;
  source?: string;
  importable: boolean;
  version?: string;
  /** Why DABOOK cannot be used (or `undefined` when it is ready / merely disabled). */
  reason?: string;
  checkedAt: number;
}

const DABOOK_PROBE_TTL_MS = 60_000;
let dabookProbeCache: { key: string; info: DabookRuntimeInfo } | undefined;

export function resetDabookRuntimeCache(): void {
  dabookProbeCache = undefined;
}

/**
 * Synchronous, cached probe for the DABOOK sidecar: is an interpreter configured, does it exist,
 * and can it `import dabook`? Used by the capability hub, which builds its list synchronously.
 * The async `DabookBridge.health()` is the authoritative check (it also runs `dabook doctor`).
 */
export function discoverDabookRuntime(
  workspaceRoot = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
  options: { now?: () => number; run?: typeof execFileSync } = {}
): DabookRuntimeInfo {
  const now = (options.now ?? Date.now)();
  const run = options.run ?? execFileSync;
  const config = resolveDabookConfig(env, workspaceRoot);
  const key = JSON.stringify([config.enabled, config.interpreterCandidates.map(candidate => candidate.path)]);
  if (dabookProbeCache && dabookProbeCache.key === key && now - dabookProbeCache.info.checkedAt < DABOOK_PROBE_TTL_MS) {
    return dabookProbeCache.info;
  }

  const info: DabookRuntimeInfo = { enabled: config.enabled, importable: false, checkedAt: now };
  const missing: string[] = [];
  for (const candidate of config.interpreterCandidates) {
    if (!fs.existsSync(candidate.path)) {
      missing.push(candidate.source);
      continue;
    }
    try {
      const output = String(run(candidate.path, ['-c', 'import dabook; print(dabook.__version__)'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 15_000,
        stdio: ['ignore', 'pipe', 'ignore']
      })).trim();
      if (output) {
        info.interpreter = candidate.path;
        info.source = candidate.source;
        info.importable = true;
        info.version = output.split(/\r?\n/).pop();
        break;
      }
    } catch {
      // interpreter exists but dabook is not importable from it; try the next candidate
    }
  }
  if (!info.importable) {
    info.reason = missing.length === config.interpreterCandidates.length
      ? 'No Python interpreter found. Run `npm run setup:dabook` or set DABOOK_PYTHON.'
      : 'A Python interpreter exists but cannot import dabook. Run `npm run setup:dabook`.';
  }
  dabookProbeCache = { key, info };
  return info;
}
