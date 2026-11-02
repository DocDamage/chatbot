import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

export const workspaceRoot = path.resolve(scriptDirectory, '..', '..');
export const dabookRoot = path.join(workspaceRoot, 'services', 'dabook');
export const venvRoot = path.join(dabookRoot, '.venv');
export const venvPython = process.platform === 'win32'
  ? path.join(venvRoot, 'Scripts', 'python.exe')
  : path.join(venvRoot, 'bin', 'python');

// Stable releases DABOOK is tested against, in preference order (pre-releases are skipped).
export const SUPPORTED_PYTHONS = ['3.12', '3.13', '3.11'];
