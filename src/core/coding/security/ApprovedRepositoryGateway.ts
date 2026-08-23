import fs from 'fs';
import path from 'path';
import { isSensitiveWorkspacePath } from './WorkspacePathPolicy';

export type RepositoryPathKind = 'any' | 'file' | 'directory';

export interface RepositoryGatewayOptions {
  ignoredDirectories?: Iterable<string>;
  maxFiles?: number;
  maxReadBytes?: number;
  maxSearchBytesPerFile?: number;
  maxSearchResults?: number;
}

export interface RepositoryReadResult {
  path: string;
  content: string;
  size: number;
  truncated: boolean;
}

export interface RepositorySearchMatch {
  path: string;
  line: number;
  text: string;
}

export interface RepositorySearchResult {
  matches: RepositorySearchMatch[];
  scannedFiles: number;
  skippedFiles: number;
  truncated: boolean;
}

export class RepositoryAccessError extends Error {
  constructor(
    public readonly code: 'INVALID_PATH' | 'OUTSIDE_ROOT' | 'SENSITIVE_PATH' | 'SYMLINK' | 'WRONG_TYPE' | 'BINARY_FILE' | 'LIMIT_EXCEEDED',
    message: string
  ) {
    super(message);
    this.name = 'RepositoryAccessError';
  }
}

const DEFAULT_IGNORED_DIRECTORIES = new Set([
  '.git', '.gradle', '.idea', '.mypy_cache', '.next', '.pytest_cache', '.ruff_cache', '.venv',
  '.vscode', '__pycache__', 'bin', 'build', 'coverage', 'dist', 'logs', 'node_modules', 'obj',
  'target', 'vendor'
]);

const TEXT_EXTENSIONS = new Set([
  '.bash', '.c', '.cc', '.cfg', '.cmake', '.cpp', '.cs', '.css', '.cxx', '.env.example', '.fs',
  '.fsx', '.go', '.h', '.hh', '.hpp', '.html', '.java', '.js', '.json', '.jsx', '.kt', '.kts',
  '.lua', '.m', '.md', '.mjs', '.mm', '.py', '.pyi', '.rs', '.scss', '.sh', '.sql', '.svelte',
  '.swift', '.toml', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml'
]);

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
}

export class ApprovedRepositoryGateway {
  private readonly root: string;
  private readonly realRoot: string;
  private readonly ignoredDirectories: Set<string>;
  private readonly maxFiles: number;
  private readonly maxReadBytes: number;
  private readonly maxSearchBytesPerFile: number;
  private readonly maxSearchResults: number;

  constructor(workspaceRoot = process.cwd(), options: RepositoryGatewayOptions = {}) {
    this.root = path.resolve(workspaceRoot);
    const rootStats = fs.statSync(this.root);
    if (!rootStats.isDirectory()) {
      throw new RepositoryAccessError('WRONG_TYPE', 'Approved repository root must be a directory.');
    }
    this.realRoot = fs.realpathSync.native(this.root);
    this.ignoredDirectories = new Set(options.ignoredDirectories || DEFAULT_IGNORED_DIRECTORIES);
    this.maxFiles = clamp(options.maxFiles ?? 5000, 1, 20_000);
    this.maxReadBytes = clamp(options.maxReadBytes ?? 256 * 1024, 1024, 2 * 1024 * 1024);
    this.maxSearchBytesPerFile = clamp(options.maxSearchBytesPerFile ?? 128 * 1024, 1024, this.maxReadBytes);
    this.maxSearchResults = clamp(options.maxSearchResults ?? 100, 1, 500);
  }

  get approvedRoot(): string {
    return this.realRoot;
  }

  listFiles(directory = '.', requestedMaxFiles = 200): string[] {
    const maximum = clamp(requestedMaxFiles, 1, this.maxFiles);
    const start = this.resolveExisting(directory, 'directory');
    const results: string[] = [];

    const walk = (current: string): void => {
      if (results.length >= maximum) return;
      const entries = fs.readdirSync(current, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));

      for (const entry of entries) {
        if (results.length >= maximum) break;
        if (this.ignoredDirectories.has(entry.name) || entry.name.startsWith('.tmp')) continue;
        const absolute = path.join(current, entry.name);
        const relative = this.relative(absolute);
        if (isSensitiveWorkspacePath(relative) || entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) walk(absolute);
        else if (entry.isFile()) results.push(relative);
      }
    };

    walk(start);
    return results;
  }

  readTextFile(file: string, requestedMaxBytes = this.maxReadBytes): RepositoryReadResult {
    const absolute = this.resolveExisting(file, 'file');
    const stats = fs.statSync(absolute);
    const maximum = clamp(requestedMaxBytes, 1024, this.maxReadBytes);
    const length = Math.min(stats.size, maximum);
    const descriptor = fs.openSync(absolute, 'r');
    const buffer = Buffer.alloc(length);

    try {
      if (length > 0) fs.readSync(descriptor, buffer, 0, length, 0);
    } finally {
      fs.closeSync(descriptor);
    }

    if (buffer.subarray(0, Math.min(buffer.length, 4096)).includes(0)) {
      throw new RepositoryAccessError('BINARY_FILE', `Binary files are not readable through repository tools: ${file}`);
    }

    return {
      path: this.relative(absolute),
      content: buffer.toString('utf8'),
      size: stats.size,
      truncated: stats.size > maximum
    };
  }

  searchText(query: string, options: { maxResults?: number; maxFiles?: number; maxBytesPerFile?: number } = {}): RepositorySearchResult {
    const needle = query.trim();
    if (!needle || needle.length > 512) {
      throw new RepositoryAccessError('LIMIT_EXCEEDED', 'Search query must contain between 1 and 512 characters.');
    }

    const maximumResults = clamp(options.maxResults ?? 50, 1, this.maxSearchResults);
    const maximumFiles = clamp(options.maxFiles ?? 1000, 1, this.maxFiles);
    const maximumBytes = clamp(options.maxBytesPerFile ?? this.maxSearchBytesPerFile, 1024, this.maxReadBytes);
    const lowerNeedle = needle.toLowerCase();
    const files = this.listFiles('.', maximumFiles);
    const matches: RepositorySearchMatch[] = [];
    let skippedFiles = 0;

    for (const file of files) {
      if (matches.length >= maximumResults) break;
      if (!this.isTextCandidate(file)) {
        skippedFiles += 1;
        continue;
      }

      const result = this.readTextFile(file, maximumBytes);
      if (result.truncated) {
        skippedFiles += 1;
        continue;
      }
      const lines = result.content.split(/\r?\n/);
      for (let index = 0; index < lines.length && matches.length < maximumResults; index += 1) {
        if (lines[index].toLowerCase().includes(lowerNeedle)) {
          matches.push({ path: result.path, line: index + 1, text: lines[index].trim().slice(0, 1000) });
        }
      }
    }

    return {
      matches,
      scannedFiles: files.length,
      skippedFiles,
      truncated: files.length >= maximumFiles || matches.length >= maximumResults
    };
  }

  resolveExisting(inputPath: string, expectedKind: RepositoryPathKind = 'any'): string {
    const normalizedInput = this.normalizeInput(inputPath);
    if (isSensitiveWorkspacePath(normalizedInput)) {
      throw new RepositoryAccessError('SENSITIVE_PATH', `Sensitive repository path is not available: ${inputPath}`);
    }

    const absolute = path.resolve(this.root, normalizedInput || '.');
    this.assertInside(absolute, this.root, 'OUTSIDE_ROOT');
    this.assertNoSymlinkSegments(absolute);
    const real = fs.realpathSync.native(absolute);
    this.assertInside(real, this.realRoot, 'OUTSIDE_ROOT');
    const relative = this.relative(real);
    if (isSensitiveWorkspacePath(relative)) {
      throw new RepositoryAccessError('SENSITIVE_PATH', `Sensitive repository path is not available: ${inputPath}`);
    }

    const stats = fs.statSync(real);
    if (expectedKind === 'file' && !stats.isFile()) {
      throw new RepositoryAccessError('WRONG_TYPE', `Repository path is not a file: ${inputPath}`);
    }
    if (expectedKind === 'directory' && !stats.isDirectory()) {
      throw new RepositoryAccessError('WRONG_TYPE', `Repository path is not a directory: ${inputPath}`);
    }
    return real;
  }

  private normalizeInput(inputPath: string): string {
    const value = String(inputPath || '.').trim();
    if (value.includes('\0') || path.isAbsolute(value)) {
      throw new RepositoryAccessError('INVALID_PATH', 'Repository paths must be relative and cannot contain null bytes.');
    }
    return value.replace(/^\.([\\/])/, '');
  }

  private assertNoSymlinkSegments(absolute: string): void {
    const relationship = path.relative(this.root, absolute);
    let current = this.root;
    for (const segment of relationship.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      if (fs.lstatSync(current).isSymbolicLink()) {
        throw new RepositoryAccessError('SYMLINK', `Symbolic links and junctions are not allowed: ${this.relative(current)}`);
      }
    }
  }

  private assertInside(candidate: string, root: string, code: RepositoryAccessError['code']): void {
    const relationship = path.relative(root, candidate);
    if (relationship === '') return;
    if (path.isAbsolute(relationship) || relationship === '..' || relationship.startsWith(`..${path.sep}`)) {
      throw new RepositoryAccessError(code, 'Path resolves outside the approved repository root.');
    }
  }

  private relative(absolute: string): string {
    return path.relative(this.realRoot, absolute).replace(/\\/g, '/');
  }

  private isTextCandidate(file: string): boolean {
    const basename = path.basename(file);
    if (/^(?:Dockerfile|Makefile|CMakeLists\.txt)$/i.test(basename)) return true;
    if (/\.env\.example$/i.test(basename)) return true;
    return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
  }
}
