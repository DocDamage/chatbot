import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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
