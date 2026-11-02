import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ApprovedRepositoryGateway } from '../security/ApprovedRepositoryGateway';
import { isSensitiveWorkspacePath } from '../security/WorkspacePathPolicy';
import { CodingToolError } from './CodingToolConfig';
import { PatchConflictDetector } from '../editing/PatchConflictDetector';

export interface ToolFile { path: string; content: string; sha256: string; exists?: boolean }
const sourceFile = /\.(?:[cm]?[jt]sx?|py|pyi|rs|go|java|cs|c|cpp|h|hpp|gd|json|toml|md)$/i;
export function allowedToolPath(file: string): boolean {
  return !isSensitiveWorkspacePath(file) && !file.split(/[\\/]/).some(part => /^(?:data|temp|output|\.capabilities|\.git|node_modules|\.serena|\.aider.*|\.aws|\.ssh|\.codex|\.claude|\.cursor|\.config|\.docker|\.kube|\.env.*|\.npmrc|\.netrc|auth\.json|api[_-]?keys?(?:\..*)?|credentials?(?:\..*)?|secrets?(?:\..*)?|tokens?(?:\..*)?)$/i.test(part));
}
export function captureNewFiles(root: string, files: string[] = []): ToolFile[] {
  if (files.length > 8 || new Set(files).size !== files.length) throw new CodingToolError('Select at most eight distinct new files.');
  const policy = new PatchConflictDetector(root);
  return files.map(file => {
    if (!allowedToolPath(file) || !sourceFile.test(file)) throw new CodingToolError('New file path is not an allowed source path.', 403);
    const absolute = policy.safe(file);
    if (fs.existsSync(absolute)) throw new CodingToolError(`New file already exists: ${file}`, 409);
    return { path: path.relative(root, absolute).replace(/\\/g, '/'), content: '', sha256: '', exists: false };
  });
}
export function captureFiles(root: string, paths?: string[], maxBytes = 96 * 1024, maxFiles = 16): ToolFile[] {
  const gateway = new ApprovedRepositoryGateway(root, { maxReadBytes: 256 * 1024 });
  const files = paths || gateway.listFiles('.', 3000).filter(file => allowedToolPath(file) && sourceFile.test(file));
  if (!files.length || files.length > maxFiles) throw new CodingToolError(`Select between 1 and ${maxFiles} source files.`);
  let bytes = 0;
  return [...new Set(files)].map(file => {
    if (!allowedToolPath(file) || !sourceFile.test(file)) throw new CodingToolError('Credential, runtime, tool configuration and non-source paths are excluded.', 403);
    const record = gateway.readTextFile(file);
    if (record.truncated) throw new CodingToolError(`File exceeds the coding input budget: ${file}`, 413);
    bytes += Buffer.byteLength(record.content);
    if (bytes > maxBytes) throw new CodingToolError('Selected files exceed the coding context budget. Narrow the selection.', 413);
    return { path: record.path, content: record.content, sha256: crypto.createHash('sha256').update(record.content).digest('hex') };
  });
}
export function materialize(directory: string, files: ToolFile[]): string {
  const workspace = path.join(directory, 'workspace'); fs.mkdirSync(workspace, { recursive: true });
  for (const file of files) {
    const destination = path.resolve(workspace, file.path), relative = path.relative(workspace, destination);
    if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep)) throw new CodingToolError('Snapshot path escaped its workspace.', 403);
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, file.content, { flag: 'wx' });
  }
  return workspace;
}
