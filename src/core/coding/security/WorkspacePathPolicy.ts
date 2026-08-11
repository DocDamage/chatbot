import * as path from 'path';

const SENSITIVE_DIRECTORIES = new Set(['api keys', 'credentials', 'private', 'secrets', '.secrets']);
const SENSITIVE_FILE_NAMES = new Set(['credentials.json', 'secrets.json', 'id_rsa', 'id_ed25519']);

/** Repository discovery and editing must never expose credential material. */
export function isSensitiveWorkspacePath(file: string): boolean {
  const normalized = file.replace(/\\/g, '/').replace(/^\.\//, '');
  const segments = normalized.split('/').filter(Boolean).map(segment => segment.toLowerCase());
  const basename = path.posix.basename(normalized).toLowerCase();
  if (segments.some(segment => SENSITIVE_DIRECTORIES.has(segment))) return true;
  if (SENSITIVE_FILE_NAMES.has(basename)) return true;
  if (/^\.env(?:\.(?:local|development|production|test|staging))?$/i.test(basename)) return true;
  if (/\.(?:pem|key|p12|pfx)$/i.test(basename)) return true;
  return false;
}
