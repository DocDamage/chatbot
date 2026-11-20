import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { resolveProjectPath } from '../engine/ProjectPathGuard';
import { digestJson } from '../engine/CanonicalJson';
import { ProjectEnrollmentError, ProjectIdentity } from './ProjectEnrollmentTypes';
import { hasControlCharacters, isWellFormedUnicode } from './Unicode';

/** Reject Windows aliases/streams before filesystem resolution; normal roots/UNC shares remain valid. */
export function validateEnrollmentPath(value: string): void {
  if (typeof value !== 'string' || !value || value.length > 4096 || !isWellFormedUnicode(value) || hasControlCharacters(value) || /^\\\\[?.]\\/.test(value)) {
    throw new ProjectEnrollmentError('INVALID_PROJECT_ROOT', 'Provide an unambiguous project directory.', 400);
  }
  const tail = value.slice(path.parse(value).root.length);
  if (tail.split(/[\\/]/).some(part => part === '..' || (part !== '.' && /[. ]$|[:<>"|?*]/.test(part)) ||
    /^(?:CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i.test(part))) {
    throw new ProjectEnrollmentError('INVALID_PROJECT_ROOT', 'Project roots cannot contain streams, traversal or ambiguous Windows names.', 400);
  }
}

export function inspectProjectIdentity(workspaceRoot: string, requestedRoot: string): ProjectIdentity {
  validateEnrollmentPath(requestedRoot);
  const target = resolveProjectPath(workspaceRoot, requestedRoot);
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    throw new ProjectEnrollmentError('PROJECT_ROOT_MISSING', 'The enrolled project directory is missing; re-enroll a moved project.');
  }
  const canonicalRoot = fs.realpathSync.native(target);
  const stats = fs.statSync(canonicalRoot, { bigint: true });
  if (stats.ino === 0n) throw new ProjectEnrollmentError('ROOT_IDENTITY_UNAVAILABLE', 'The filesystem exposes no stable directory identity.');
  const filesystemIdentity = digestJson('project-filesystem:v1', { dev: String(stats.dev), ino: String(stats.ino), birthtime: String(stats.birthtimeMs) });
  const physicalKey = digestJson('project-physical:v1', { root: process.platform === 'win32' ? canonicalRoot.toLowerCase() : canonicalRoot, filesystemIdentity });
  return { canonicalRoot, filesystemIdentity, physicalKey };
}

/** Exact byte hash and separate decoding; no normalized search text is hashed. */
export function readProjectText(root: string, relative: string, maximum = 1_048_576): { content: string; sha256: string; byteLength: number } {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => !part || part === '.' || part === '..' || part.includes(':') || hasControlCharacters(part))) {
    throw new ProjectEnrollmentError('INVALID_DESCRIPTOR_PATH', 'Metadata references must be project-relative without traversal.', 400);
  }
  const full = resolveProjectPath(root, relative);
  if (!fs.existsSync(full)) throw new ProjectEnrollmentError('PROJECT_DESCRIPTOR_MISSING', `Required project metadata is missing: ${relative}`, 400);
  const stat = fs.statSync(full);
  if (!stat.isFile() || stat.size > maximum) throw new ProjectEnrollmentError('DESCRIPTOR_LIMIT', `Project metadata exceeds its file/byte limit: ${relative}`, 413);
  const bytes = fs.readFileSync(full);
  if (bytes.length > maximum) throw new ProjectEnrollmentError('DESCRIPTOR_LIMIT', `Project metadata exceeds its byte limit: ${relative}`, 413);
  const content = bytes.toString('utf8');
  if (bytes.includes(0) || !Buffer.from(content, 'utf8').equals(bytes)) throw new ProjectEnrollmentError('DESCRIPTOR_ENCODING', `Project metadata must be lossless UTF-8: ${relative}`, 400);
  return { content: content.replace(/^\uFEFF/, ''), sha256: crypto.createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
}
