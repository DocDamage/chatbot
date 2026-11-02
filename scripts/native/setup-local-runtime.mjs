import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, '..', '..');
const runtimeRoot = path.join(workspaceRoot, 'data', 'native-runtime', 'python');
const python = process.platform === 'win32'
  ? path.join(runtimeRoot, 'Scripts', 'python.exe')
  : path.join(runtimeRoot, 'bin', 'python');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    encoding: 'utf8',
    windowsHide: true,
    stdio: options.capture ? 'pipe' : 'inherit'
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout || `exit ${result.status}`;
    throw new Error(`${command} ${args.join(' ')} failed: ${String(detail).trim()}`);
  }
  return String(result.stdout || '').trim();
}

function locate(command) {
  try {
    const locator = process.platform === 'win32' ? 'where.exe' : 'which';
    return run(locator, [command], { capture: true }).split(/\r?\n/)[0];
  } catch {
    return undefined;
  }
}

const uv = locate('uv');
if (!uv) {
  throw new Error('uv is required. Install it from https://docs.astral.sh/uv/ and run this command again.');
}

if (!existsSync(python)) {
  run(uv, ['venv', runtimeRoot, '--python', '3.10']);
}

run(uv, ['pip', 'install', '--python', python, 'faster-whisper', 'demucs']);
run(python, ['-c', 'import faster_whisper, demucs; print("Native Python backends imported successfully.")']);

const external = {
  ffmpeg: locate('ffmpeg'),
  ffprobe: locate('ffprobe'),
  ollama: locate('ollama'),
  godot: locate('godot') || locate('godot4'),
  demucs: process.platform === 'win32'
    ? path.join(runtimeRoot, 'Scripts', 'demucs.exe')
    : path.join(runtimeRoot, 'bin', 'demucs')
};

process.stdout.write(`${JSON.stringify({
  ready: true,
  python,
  external,
  notes: [
    'Faster Whisper models download lazily on first use.',
    'Windows SAPI speech and screen capture use built-in PowerShell/.NET APIs.',
    'Unity and Unreal require separately installed, licensed, complete editor installations.'
  ]
}, null, 2)}\n`);
