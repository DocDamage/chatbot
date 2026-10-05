import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dabookRoot, SUPPORTED_PYTHONS, venvPython, venvRoot } from './dabook-env.mjs';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: dabookRoot,
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

function succeeds(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, stdio: 'pipe' });
  return !result.error && result.status === 0 ? String(result.stdout || '').trim() : null;
}

function createWithUv() {
  if (!succeeds('uv', ['--version'])) return false;
  for (const version of SUPPORTED_PYTHONS) {
    if (succeeds('uv', ['python', 'find', version])) {
      run('uv', ['venv', '--python', version, venvRoot]);
      run('uv', ['pip', 'install', '--python', venvPython, '-e', '.[dev]']);
      return true;
    }
  }
  return false;
}

function findPython() {
  if (process.env.DABOOK_PYTHON) return [process.env.DABOOK_PYTHON];
  const candidates = process.platform === 'win32'
    ? SUPPORTED_PYTHONS.map(version => ['py', `-${version}`])
    : SUPPORTED_PYTHONS.map(version => [`python${version}`]);
  candidates.push(['python3'], ['python']);
  return candidates.find(([command, ...args]) => {
    const version = succeeds(command, [...args, '-c', 'import sys; print(sys.version_info[:2] >= (3, 11))']);
    return version === 'True';
  });
}

function createWithVenv() {
  const python = findPython();
  if (!python) {
    throw new Error(`No Python ${SUPPORTED_PYTHONS.join('/')} found. Install one, or set DABOOK_PYTHON to its path.`);
  }
  const [command, ...args] = python;
  run(command, [...args, '-m', 'venv', venvRoot]);
  run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip']);
  run(venvPython, ['-m', 'pip', 'install', '-e', '.[dev]']);
}

if (existsSync(venvPython) && !process.argv.includes('--force')) {
  console.log(`Updating existing DABOOK venv at ${venvRoot} (pass --force to recreate).`);
  if (succeeds('uv', ['--version'])) {
    run('uv', ['pip', 'install', '--python', venvPython, '-e', '.[dev]']);
  } else {
    run(venvPython, ['-m', 'pip', 'install', '-e', '.[dev]']);
  }
} else if (process.env.DABOOK_PYTHON || !createWithUv()) {
  createWithVenv();
}

console.log(run(venvPython, ['-m', 'dabook', '--help'], { capture: true }).split(/\r?\n/).slice(0, 3).join('\n'));
console.log(`DABOOK ready: ${venvPython}`);
