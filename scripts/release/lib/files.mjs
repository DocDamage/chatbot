import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_IGNORED_DIRECTORIES = new Set([
  '.git', '.next', '.playwright-cli', 'cache', 'coverage', 'data', 'dist',
  'knowledge-base', 'knowledge-base-public', 'local-tools', 'node_modules',
  'private-tools', 'tmp', 'vendor'
]);

export function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

export function isIgnoredPath(relativePath, extraIgnored = []) {
  const ignored = new Set([...DEFAULT_IGNORED_DIRECTORIES, ...extraIgnored]);
  return toPosix(relativePath).split('/').some(part => ignored.has(part));
}

export function walkFiles(root, options = {}) {
  const include = options.include ?? (() => true);
  const extraIgnored = options.ignoredDirectories ?? [];
  const results = [];

  function visit(current) {
    const relative = path.relative(root, current);
    if (relative && isIgnoredPath(relative, extraIgnored)) return;

    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current).sort()) {
        visit(path.join(current, entry));
      }
      return;
    }

    if (stat.isFile() && include(current, relative)) {
      results.push(toPosix(relative));
    }
  }

  visit(root);
  return results.sort();
}

export function readText(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

export function lineCount(text) {
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).length;
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function writeText(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

export function fileExists(root, relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

export function normalizeImportPath(importer, specifier, candidates) {
  if (!specifier.startsWith('.')) return null;
  const base = toPosix(path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier)));
  const possibilities = [
    base,
    `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.mjs`, `${base}.cjs`,
    `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.js`, `${base}/index.jsx`,
    `${base}/index.mjs`, `${base}/index.cjs`
  ];
  return possibilities.find(candidate => candidates.has(candidate)) ?? null;
}

export function matchesGlobLike(filePath, pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*');
  return new RegExp(`^${escaped}$`).test(toPosix(filePath));
}
