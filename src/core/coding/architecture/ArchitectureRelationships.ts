import path from 'path';
import { IndexedSymbol } from '../index/ParserProvider';
import { ArchitectureEdgeKind, ScannedArchitectureFile } from './ArchitectureTypes';
import { isTestPath } from './ArchitectureDetectors';

export interface ArchitectureRelationshipCandidate {
  kind: ArchitectureEdgeKind;
  sourceFile: string;
  sourceSymbol?: IndexedSymbol;
  targetFile?: string;
  targetSymbol?: IndexedSymbol;
  externalModule?: string;
  line: number;
  confidence: number;
  detail: string;
  unresolvedLocal?: string;
}

interface ImportReference { module: string; line: number; system?: boolean; }
interface GoModule { name: string; root: string; }

export function detectArchitectureRelationships(files: ScannedArchitectureFile[]): ArchitectureRelationshipCandidate[] {
  const textFiles = files.filter(file => file.content);
  const knownFiles = new Set(files.map(file => file.path));
  const definitions = textFiles.flatMap(file => file.symbols)
    .filter(symbol => !['import', 'export', 'test', 'route'].includes(symbol.kind));
  const definitionsByName = groupDefinitions(definitions);
  const goModules = detectGoModules(textFiles);
  const candidates: ArchitectureRelationshipCandidate[] = [];

  for (const file of textFiles) {
    const lines = file.content!.split(/\r?\n/);
    const localSymbols = file.symbols
      .filter(symbol => !['import', 'export'].includes(symbol.kind))
      .sort((left, right) => left.line - right.line);
    const importsByLine = groupImports(importsInFile(file));

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      for (const imported of importsByLine.get(lineNumber) || []) {
        const target = resolveLocalImport(file.path, imported, knownFiles, goModules);
        const sourceSymbol = nearestSymbol(localSymbols, lineNumber);
        if (target) {
          candidates.push({
            kind: isTestPath(file.path) ? 'tests' : 'imports',
            sourceFile: file.path,
            sourceSymbol,
            targetFile: target,
            line: lineNumber,
            confidence: 0.94,
            detail: `static import ${imported.module}`
          });
        } else if (isLocalImport(file.path, imported, knownFiles, goModules)) {
          candidates.push({
            kind: 'imports',
            sourceFile: file.path,
            sourceSymbol,
            line: lineNumber,
            confidence: 0.45,
            detail: `unresolved local import ${imported.module}`,
            unresolvedLocal: imported.module
          });
        } else {
          candidates.push({
            kind: 'depends_on',
            sourceFile: file.path,
            sourceSymbol,
            externalModule: dependencyRoot(imported.module),
            line: lineNumber,
            confidence: 0.82,
            detail: `external import ${imported.module}`
          });
        }
      }

      const implementation = line.match(/\b(implements|extends)\s+([A-Za-z_$][\w$]*)/i);
      if (implementation) {
        const target = uniqueOtherDefinition(definitionsByName.get(implementation[2]) || [], file.path);
        if (target) candidates.push({
          kind: implementation[1].toLowerCase() === 'extends' ? 'extends' : 'implements',
          sourceFile: file.path,
          sourceSymbol: nearestSymbol(localSymbols, lineNumber),
          targetSymbol: target,
          line: lineNumber,
          confidence: 0.9,
          detail: `${implementation[1]} ${implementation[2]}`
        });
      }

      const identifiers = new Set(line.match(/[A-Za-z_$][\w$]*/g) || []);
      for (const identifier of identifiers) {
        if (identifier.length < 3) continue;
        const target = uniqueOtherDefinition(definitionsByName.get(identifier) || [], file.path);
        if (!target) continue;
        const calling = new RegExp(`\\b${escapeRegExp(identifier)}\\s*\\(`).test(line);
        candidates.push({
          kind: calling ? 'calls' : 'references',
          sourceFile: file.path,
          sourceSymbol: nearestSymbol(localSymbols, lineNumber),
          targetSymbol: target,
          line: lineNumber,
          confidence: calling ? 0.86 : 0.72,
          detail: `${calling ? 'call' : 'reference'} ${identifier}`
        });
      }
    });
  }

  return dedupe(candidates);
}

function importsInFile(file: ScannedArchitectureFile): ImportReference[] {
  const lines = file.content!.split(/\r?\n/);
  const results: ImportReference[] = [];
  let goBlock = false;
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (/^\s*import\s*\(\s*$/.test(line)) goBlock = true;
    if (goBlock && /^\s*\)\s*$/.test(line)) { goBlock = false; return; }
    const patterns = [
      /\bimport\s+(?:[^'"`]+?\s+from\s+)?['"`]([^'"`]+)['"`]/g,
      /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /^\s*from\s+([\w.]+)\s+import\b/g,
      /^\s*import\s+([\w.]+)\b/g,
      /^\s*@import\s+(?:url\()?['"]([^'"]+)['"]/g
    ];
    for (const pattern of patterns) {
      for (const match of line.matchAll(pattern)) if (match[1]) results.push({ module: match[1], line: lineNumber });
    }
    const include = line.match(/^\s*#include\s*([<"])([^>"]+)[>"]/);
    if (include) results.push({ module: include[2], line: lineNumber, system: include[1] === '<' });
    if (/\.rs$/.test(file.path)) {
      const rust = line.match(/^\s*(?:use|mod)\s+([^;{]+)/)?.[1];
      if (rust) results.push({ module: rust.trim(), line: lineNumber });
    }
    if (/\.go$/.test(file.path)) {
      const direct = line.match(/^\s*import\s+(?:[\w.]+\s+)?["`]([^"`]+)["`]/)?.[1];
      const grouped = goBlock ? line.match(/^\s*(?:[\w.]+\s+)?["`]([^"`]+)["`]\s*$/)?.[1] : undefined;
      if (direct || grouped) results.push({ module: direct || grouped!, line: lineNumber });
    }
  });
  return uniqueImports(results);
}

function resolveLocalImport(
  from: string,
  imported: ImportReference,
  knownFiles: Set<string>,
  goModules: GoModule[]
): string | undefined {
  const normalizedFrom = from.replace(/\\/g, '/');
  const value = imported.module.replace(/\\/g, '/');
  if (imported.system) return undefined;
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.svelte', '.css', '.scss', '.py', '.pyi', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.h', '.cpp', '.hpp', '.lua'];
  const candidates: string[] = [];

  if (value.startsWith('.')) {
    const stem = path.posix.normalize(path.posix.join(path.posix.dirname(normalizedFrom), value));
    candidates.push(stem, ...extensions.map(extension => `${stem}${extension}`), ...extensions.map(extension => `${stem}/index${extension}`), `${stem}/__init__.py`, `${stem}/mod.rs`);
  } else if (/\.pyi?$/.test(normalizedFrom) && /^[\w.]+$/.test(value)) {
    const stem = value.replace(/\./g, '/');
    candidates.push(`${stem}.py`, `${stem}.pyi`, `${stem}/__init__.py`, `src/${stem}.py`, `src/${stem}/__init__.py`);
    const localStem = path.posix.join(path.posix.dirname(normalizedFrom), stem);
    candidates.push(`${localStem}.py`, `${localStem}/__init__.py`);
  } else if (/\.(?:c|cc|cpp|cxx|h|hpp)$/.test(normalizedFrom)) {
    candidates.push(path.posix.normalize(path.posix.join(path.posix.dirname(normalizedFrom), value)), value);
  } else if (/\.rs$/.test(normalizedFrom) && /^(?:crate|self|super)::/.test(value)) {
    const sourceRoot = rustSourceRoot(normalizedFrom);
    const stem = value.replace(/^(?:crate|self|super)::/, '').replace(/::/g, '/');
    const moduleStem = stem.includes('/') ? stem.slice(0, stem.lastIndexOf('/')) : stem;
    candidates.push(
      `${sourceRoot}/${stem}.rs`,
      `${sourceRoot}/${stem}/mod.rs`,
      `${sourceRoot}/${moduleStem}.rs`,
      `${sourceRoot}/${moduleStem}/mod.rs`,
      path.posix.join(path.posix.dirname(normalizedFrom), `${stem}.rs`),
      path.posix.join(path.posix.dirname(normalizedFrom), `${moduleStem}.rs`)
    );
  } else if (/\.lua$/.test(normalizedFrom)) {
    const stem = value.replace(/\./g, '/');
    candidates.push(`${stem}.lua`, `${stem}/init.lua`, path.posix.join(path.posix.dirname(normalizedFrom), `${stem}.lua`));
  }

  for (const module of goModules) {
    if (value !== module.name && !value.startsWith(`${module.name}/`)) continue;
    const suffix = value.slice(module.name.length).replace(/^\//, '');
    const directory = path.posix.normalize(path.posix.join(module.root, suffix)).replace(/^\.\//, '');
    const goFile = [...knownFiles].sort().find(file => path.posix.dirname(file) === directory && file.endsWith('.go'));
    if (goFile) return goFile;
  }
  return candidates.map(candidate => candidate.replace(/^\.\//, '')).find(candidate => knownFiles.has(candidate));
}

function isLocalImport(
  source: string,
  imported: ImportReference,
  knownFiles: Set<string>,
  goModules: GoModule[]
): boolean {
  const value = imported.module;
  if (value.startsWith('.') || /^(?:crate|self|super)::/.test(value)) return true;
  if (imported.system) return false;
  if (/\.(?:c|cc|cpp|cxx|h|hpp)$/.test(source)) return true;
  if (/\.lua$/.test(source)) return knownFiles.has(`${value.replace(/\./g, '/')}.lua`);
  return goModules.some(module => value === module.name || value.startsWith(`${module.name}/`));
}

function detectGoModules(files: ScannedArchitectureFile[]): GoModule[] {
  return files.filter(file => path.posix.basename(file.path) === 'go.mod' && file.content).flatMap(file => {
    const name = file.content!.match(/^\s*module\s+([^\s]+)/m)?.[1];
    return name ? [{ name, root: path.posix.dirname(file.path) === '.' ? '.' : path.posix.dirname(file.path) }] : [];
  });
}

function rustSourceRoot(source: string): string {
  const parts = source.split('/');
  const index = parts.lastIndexOf('src');
  return index >= 0 ? parts.slice(0, index + 1).join('/') : path.posix.dirname(source);
}

function dependencyRoot(value: string): string {
  const cleaned = value.replace(/^node:/, '').replace(/^['"]|['"]$/g, '');
  if (cleaned.startsWith('@')) return cleaned.split('/').slice(0, 2).join('/');
  if (cleaned.includes('::')) return cleaned.split('::')[0];
  if (cleaned.includes('.')) return cleaned.split('.')[0];
  return cleaned.split('/')[0];
}

function groupDefinitions(values: IndexedSymbol[]): Map<string, IndexedSymbol[]> {
  const result = new Map<string, IndexedSymbol[]>();
  for (const value of values) {
    const group = result.get(value.name) || [];
    group.push(value);
    result.set(value.name, group);
  }
  return result;
}

function uniqueOtherDefinition(values: IndexedSymbol[], sourceFile: string): IndexedSymbol | undefined {
  const others = values.filter(value => value.file !== sourceFile);
  return others.length === 1 ? others[0] : undefined;
}

function nearestSymbol(values: IndexedSymbol[], line: number): IndexedSymbol | undefined {
  return [...values].reverse().find(value => value.line <= line);
}

function groupImports(values: ImportReference[]): Map<number, ImportReference[]> {
  const result = new Map<number, ImportReference[]>();
  for (const value of values) result.set(value.line, [...(result.get(value.line) || []), value]);
  return result;
}

function uniqueImports(values: ImportReference[]): ImportReference[] {
  const seen = new Set<string>();
  return values.filter(value => {
    const key = `${value.module}\0${value.line}\0${Boolean(value.system)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dedupe(values: ArchitectureRelationshipCandidate[]): ArchitectureRelationshipCandidate[] {
  const seen = new Set<string>();
  return values.filter(value => {
    const key = `${value.kind}\0${value.sourceFile}\0${value.targetFile || value.targetSymbol?.file || value.externalModule || value.unresolvedLocal}\0${value.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
