import path from 'path';
import type { ManifestRecord } from '../repository/ManifestDetector';
import { ScannedArchitectureFile } from './ArchitectureTypes';
import { normalizeRepositoryPath } from './ArchitectureIdentity';

export interface DetectedRoute { method: string; routePath: string; handler: string; line: number; framework: string; confidence: number; }
export interface DetectedTable { name: string; line: number; kind: 'creates' | 'reads' | 'writes'; confidence: number; }
export interface DetectedDependency { name: string; scope: string; line: number; }
export interface DetectedBuildTarget { name: string; command: string; line: number; }
export interface ManifestFacts { manifest: ManifestRecord; dependencies: DetectedDependency[]; buildTargets: DetectedBuildTarget[]; }
export interface DetectedEntrypoint { file: string; score: number; evidence: string[]; }

const PROJECT_MARKERS = new Set([
  'package.json', 'cargo.toml', 'go.mod', 'go.work', 'pyproject.toml', 'setup.py',
  'pom.xml', 'build.gradle', 'build.gradle.kts', 'package.swift', 'cmakelists.txt',
  'meson.build', 'project.godot'
]);

export function isGeneratedPath(file: string): boolean {
  return /(^|\/)(?:generated|gen|vendor|coverage|dist|build|out|\.cache)(?:\/|$)/i.test(file)
    || /(?:\.generated\.|\.min\.)/i.test(file);
}

export function isIndexablePath(file: string): boolean {
  return /\.(?:bash|c|cc|cpp|cxx|cs|css|fs|fsi|fsx|go|h|hh|hpp|hxx|html|java|js|jsx|kt|kts|lua|m|md|mjs|mm|py|pyi|rs|scss|sh|sql|svelte|swift|ts|tsx)$/i.test(file)
    || /(^|\/)(?:Dockerfile|Makefile|CMakeLists\.txt)$/i.test(file);
}

export function isTestPath(file: string): boolean {
  return /(^|\/)(?:test|tests|__tests__)(\/|$)|(?:\.test|\.spec)\.[^.]+$|(?:^|\/).*_test\.(?:go|py)$|(?:^|\/)test_[^/]+\.py$/i.test(file);
}

export function isMigrationPath(file: string): boolean {
  return /(^|\/)(?:migrations?|schema)(\/|$)|(?:^|\/)\d{3,}[_-].*\.sql$/i.test(file);
}

export function roleForFile(file: string): string {
  const lowered = file.toLowerCase();
  if (isTestPath(file)) return 'test';
  if (isMigrationPath(file)) return 'migration';
  if (/(^|\/)(?:routes?|controllers?|api)(\/|$)/.test(lowered)) return 'api';
  if (/(^|\/)(?:services?|usecases?)(\/|$)/.test(lowered)) return 'service';
  if (/(^|\/)(?:components?|pages?|views?|client|frontend)(\/|$)|\.(?:svelte|css|scss)$/.test(lowered)) return 'frontend';
  if (/(^|\/)(?:models?|database|db|repositories?)(\/|$)/.test(lowered)) return 'data';
  if (/(^|\/)(?:workers?|jobs?|queues?)(\/|$)/.test(lowered)) return 'worker';
  if (/^(?:dockerfile|makefile)$|\.ya?ml$|\.toml$|\.json$/.test(path.posix.basename(lowered))) return 'configuration';
  return 'source';
}

export function detectRoutes(file: ScannedArchitectureFile): DetectedRoute[] {
  if (!file.content) return [];
  const results: DetectedRoute[] = [];
  file.content.split(/\r?\n/).forEach((line, index) => {
    const candidates: Array<DetectedRoute | undefined> = [];
    const express = line.match(/\b(?:app|router|server|fastify)\.(get|post|put|patch|delete|options|head|all)\s*\(\s*['"`]([^'"`]+)['"`]\s*,?\s*([\w$.]*)/i);
    if (express) candidates.push({ method: express[1].toUpperCase(), routePath: express[2], handler: express[3] || 'inline', line: index + 1, framework: 'http-router', confidence: 0.96 });
    const decorator = line.match(/@(?:Get|Post|Put|Patch|Delete|Options|Head)\s*\(\s*['"`]([^'"`]+)['"`]/i);
    if (decorator) candidates.push({ method: line.match(/@(\w+)/)?.[1].toUpperCase() || 'ANY', routePath: decorator[1], handler: 'decorated-handler', line: index + 1, framework: 'decorator-router', confidence: 0.92 });
    const flask = line.match(/@(?:\w+\.)?(get|post|put|patch|delete|route)\s*\(\s*['"`]([^'"`]+)['"`]/i);
    if (flask) candidates.push({ method: flask[1].toLowerCase() === 'route' ? 'ANY' : flask[1].toUpperCase(), routePath: flask[2], handler: 'decorated-handler', line: index + 1, framework: 'python-router', confidence: 0.93 });
    const go = line.match(/\bHandleFunc\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([\w$.]+)/);
    if (go) candidates.push({ method: 'ANY', routePath: go[1], handler: go[2], line: index + 1, framework: 'net/http', confidence: 0.9 });
    const axum = line.match(/\.route\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(get|post|put|patch|delete)\s*\(\s*([\w:]+)/i);
    if (axum) candidates.push({ method: axum[2].toUpperCase(), routePath: axum[1], handler: axum[3], line: index + 1, framework: 'axum-like', confidence: 0.88 });
    candidates.filter((value): value is DetectedRoute => Boolean(value)).forEach(value => results.push(value));
  });
  return dedupe(results, value => `${value.method}\0${value.routePath}\0${value.handler}\0${value.framework}`);
}

export function detectTables(file: ScannedArchitectureFile): DetectedTable[] {
  if (!file.content) return [];
  const results: DetectedTable[] = [];
  file.content.split(/\r?\n/).forEach((line, index) => {
    const create = line.match(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`\[]?([\w.-]+)/i)
      || line.match(/\bmodel\s+([A-Za-z_][\w]*)\s*\{/)
      || line.match(/__tablename__\s*=\s*['"`]([^'"`]+)/)
      || line.match(/@Entity\s*\(\s*['"`]([^'"`]+)/);
    if (create) results.push({ name: cleanTable(create[1]), line: index + 1, kind: 'creates', confidence: 0.94 });
    for (const match of line.matchAll(/\b(?:FROM|JOIN)\s+["`\[]?([\w.-]+)/gi)) results.push({ name: cleanTable(match[1]), line: index + 1, kind: 'reads', confidence: 0.82 });
    for (const match of line.matchAll(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+["`\[]?([\w.-]+)/gi)) results.push({ name: cleanTable(match[1]), line: index + 1, kind: 'writes', confidence: 0.86 });
  });
  return dedupe(results.filter(value => Boolean(value.name)), value => `${value.kind}\0${value.name}\0${value.line}`);
}

export function detectManifestFacts(file: ScannedArchitectureFile): ManifestFacts | undefined {
  if (!file.content || !isManifest(file.path)) return undefined;
  const name = path.posix.basename(file.path).toLowerCase();
  const dependencies: DetectedDependency[] = [];
  const buildTargets: DetectedBuildTarget[] = [];
  let data: Record<string, unknown> | undefined;
  let parseError: string | undefined;
  if (['package.json', 'tsconfig.json', 'jsconfig.json'].includes(name)) {
    try {
      data = JSON.parse(file.content) as Record<string, unknown>;
      if (name === 'package.json') {
        for (const scope of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
          const record = data[scope];
          if (record && typeof record === 'object' && !Array.isArray(record)) {
            Object.keys(record as Record<string, unknown>).forEach(dependency => dependencies.push({ name: dependency, scope, line: 1 }));
          }
        }
        const scripts = data.scripts;
        if (scripts && typeof scripts === 'object' && !Array.isArray(scripts)) {
          Object.entries(scripts as Record<string, unknown>).sort().forEach(([target, command]) => {
            if (typeof command === 'string') buildTargets.push({ name: target, command, line: 1 });
          });
        }
      }
    } catch (error: unknown) {
      parseError = error instanceof Error ? error.message : 'Manifest parsing failed.';
    }
  } else if (/^requirements.*\.txt$/.test(name)) {
    file.content.split(/\r?\n/).forEach((line, index) => {
      const dependency = line.trim().match(/^([A-Za-z0-9_.-]+)/)?.[1];
      if (dependency && !line.trim().startsWith('#')) dependencies.push({ name: dependency, scope: 'python', line: index + 1 });
    });
  } else if (name === 'cargo.toml') {
    collectSectionDependencies(file.content, 'dependencies', 'rust', dependencies);
  } else if (name === 'go.mod') {
    file.content.split(/\r?\n/).forEach((line, index) => {
      const dependency = line.trim().match(/^(?:require\s+)?([^\s()]+)\s+v\d/)?.[1];
      if (dependency) dependencies.push({ name: dependency, scope: 'go', line: index + 1 });
    });
  } else if (name === 'pyproject.toml') {
    file.content.split(/\r?\n/).forEach((line, index) => {
      for (const match of line.matchAll(/['"]([A-Za-z0-9_.-]+)(?:[<>=!~][^'"]*)?['"]/g)) dependencies.push({ name: match[1], scope: 'python', line: index + 1 });
    });
  }
  return {
    manifest: { path: file.path, kind: name, ...(data ? { data } : {}), ...(parseError ? { parseError } : {}) },
    dependencies: dedupe(dependencies, value => value.name),
    buildTargets: dedupe(buildTargets, value => value.name)
  };
}

export function detectProjectRoots(files: string[]): string[] {
  const roots = new Set<string>();
  for (const file of files) {
    const name = path.posix.basename(file).toLowerCase();
    if (PROJECT_MARKERS.has(name) || /\.(?:sln|csproj|fsproj)$/.test(name)) roots.add(normalizeRepositoryPath(path.posix.dirname(file)));
  }
  if (!roots.size) roots.add('.');
  return [...roots].sort((left, right) => left.split('/').length - right.split('/').length || left.localeCompare(right));
}

export function projectRootForFile(file: string, roots: string[]): string {
  return [...roots].filter(root => root === '.' || file === root || file.startsWith(`${root}/`))
    .sort((left, right) => right.length - left.length)[0] || '.';
}

export function modulePathForFile(file: string, projectRoot: string): string | undefined {
  const relative = projectRoot === '.' ? file : file.slice(projectRoot.length + 1);
  const parts = path.posix.dirname(relative).split('/').filter((part: string) => part && part !== '.');
  if (!parts.length) return undefined;
  const depth = ['src', 'lib', 'app', 'client', 'server', 'packages', 'services'].includes(parts[0]) && parts[1] ? 2 : 1;
  const module = parts.slice(0, depth).join('/');
  return normalizeRepositoryPath(projectRoot === '.' ? module : `${projectRoot}/${module}`);
}

export function detectEntrypoints(files: ScannedArchitectureFile[]): DetectedEntrypoint[] {
  const conventional: Record<string, number> = {
    'main.ts': 35, 'main.tsx': 35, 'main.js': 34, 'index.ts': 26, 'index.js': 26,
    'server.ts': 40, 'server.js': 40, 'main.py': 38, '__main__.py': 42, 'app.py': 30,
    'main.go': 38, 'main.rs': 38, 'main.c': 34, 'main.cpp': 34
  };
  return files.map(file => {
    const name = path.posix.basename(file.path).toLowerCase();
    let score = conventional[name] || 0;
    const evidence: string[] = [];
    if (score) evidence.push(`conventional entrypoint filename ${name}`);
    if (file.content && /\b(?:listen|serve|run|main)\s*\(/.test(file.content)) { score += 20; evidence.push('contains an application start call'); }
    if (detectRoutes(file).length) { score += 12; evidence.push('registers HTTP routes'); }
    return { file: file.path, score, evidence };
  }).filter(value => value.score > 0)
    .sort((left, right) => right.score - left.score || left.file.localeCompare(right.file)).slice(0, 20);
}

function isManifest(file: string): boolean {
  const name = path.posix.basename(file).toLowerCase();
  return ['package.json', 'tsconfig.json', 'jsconfig.json', 'cargo.toml', 'go.mod', 'pyproject.toml'].includes(name)
    || /^requirements.*\.txt$/.test(name);
}

function collectSectionDependencies(content: string, sectionName: string, scope: string, output: DetectedDependency[]): void {
  let active = false;
  content.split(/\r?\n/).forEach((line, index) => {
    const section = line.trim().match(/^\[([^\]]+)\]/)?.[1];
    if (section) active = section === sectionName || section.endsWith(`.${sectionName}`);
    if (!active || section) return;
    const dependency = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=/)?.[1];
    if (dependency) output.push({ name: dependency, scope, line: index + 1 });
  });
}

function cleanTable(value: string): string {
  return value.replace(/[\]`";,)]/g, '').trim().toLowerCase();
}

function dedupe<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter(value => { const candidate = key(value); if (seen.has(candidate)) return false; seen.add(candidate); return true; });
}
