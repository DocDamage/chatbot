import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { isSensitiveWorkspacePath } from '../coding/security/WorkspacePathPolicy';
import { ReaConfig, ReaError } from './ReaConfig';

const ignored = new Set(['node_modules', '.git', '.capabilities', 'data', 'logs', 'coverage', '.venv', '__pycache__', 'temp', 'output', '.aws', '.ssh', '.azure', '.config']);
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.map', '.html', '.css', '.node', '.wasm', '.asar']);
const sensitive = (value: string) => isSensitiveWorkspacePath(value)
  || value.split(/[\\/]/).some(part => /^(?:\.aws|\.ssh|\.azure|\.config|\.codex|\.claude|\.cursor|\.docker|\.kube|\.npmrc|\.netrc|\.git-credentials|\.env(?:\..*)?|auth\.json|tokens?(?:\..*)?|api[_-]?keys?(?:\..*)?|credentials?(?:\..*)?|secrets?(?:\..*)?)$/i.test(part));

export function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
}

export class ReaTargets {
  constructor(private readonly config: ReaConfig) {}

  resolve(input: string): string {
    if (!input || input.includes('\0') || /^[\\/]{2}/.test(input)) throw new ReaError('A local target path is required.');
    const target = path.resolve(this.config.allowedRoots[0], input);
    if (sensitive(target)) throw new ReaError('Credential and private paths cannot be analyzed.', 403, 'REA_TARGET_DENIED');
    if (!fs.existsSync(target)) throw new ReaError('The selected target does not exist.', 404, 'REA_TARGET_MISSING');
    const real = fs.realpathSync.native(target);
    if (!this.config.allowedRoots.some(root => inside(fs.realpathSync.native(root), real))) {
      throw new ReaError('Target is outside REA_ALLOWED_ROOTS. Upload the artifact or configure its containing directory.', 403, 'REA_TARGET_DENIED');
    }
    // Reject links at every component, including junctions leading back into an allowed tree.
    let current = target;
    while (current !== path.dirname(current)) {
      if (fs.lstatSync(current).isSymbolicLink()) throw new ReaError('Symbolic links and junctions are not accepted as REA targets.', 403, 'REA_TARGET_DENIED');
      current = path.dirname(current);
    }
    return real;
  }

  snapshot(input: string, jobRoot: string): { path: string; bytes: number; files: number; sha256?: string; limitations: string[] } {
    const target = this.resolve(input);
    const destination = path.join(jobRoot, 'input', path.basename(target));
    let bytes = 0;
    let files = 0;
    let entries = 0;
    const copy = (source: string, output: string, depth = 0) => {
      if (++entries > this.config.maxFiles * 10 || depth > 40) throw new ReaError('Target directory traversal budget exceeded.', 413, 'REA_INPUT_LIMIT');
      const stat = fs.lstatSync(source);
      if (stat.isSymbolicLink() || sensitive(source)) return;
      if (stat.isDirectory()) {
        if (depth && ignored.has(path.basename(source).toLowerCase())) return;
        fs.mkdirSync(output, { recursive: true });
        for (const entry of fs.readdirSync(source)) copy(path.join(source, entry), path.join(output, entry), depth + 1);
      } else if (stat.isFile()) {
        if (depth && !sourceExtensions.has(path.extname(source).toLowerCase())) return;
        bytes += stat.size;
        if (++files > this.config.maxFiles || bytes > this.config.maxInputBytes) throw new ReaError('The target exceeds the REA input budget. Select a smaller artifact or directory.', 413, 'REA_INPUT_LIMIT');
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.copyFileSync(source, output, fs.constants.COPYFILE_EXCL);
      } else throw new ReaError('Only ordinary files and directories can be analyzed.');
    };
    copy(target, destination);
    if (!files) throw new ReaError('The selected target contains no supported source files.');
    return {
      path: destination, bytes, files,
      sha256: fs.statSync(destination).isFile() ? crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex') : undefined,
      limitations: fs.statSync(destination).isDirectory() ? ['Analysis uses a filtered snapshot. Credential paths, symbolic links, dependency caches and non-source files are excluded.'] : [],
    };
  }
}
