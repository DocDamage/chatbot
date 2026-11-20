import path from 'path';
import ts from 'typescript';
import { ApprovedRepositoryGateway } from '../security/ApprovedRepositoryGateway';
import { allowedToolPath, captureFiles, ToolFile } from './ToolWorkspace';
import { CodingToolError } from './CodingToolConfig';
import { createContextAliasResolver } from './ContextAliases';
import { WorkspaceFilePolicy, FileRole } from '../security/WorkspaceFilePolicy';
import { buildProjectDependencies, DependencyGraph } from './ProjectDependencies';

const code = /\.(?:[cm]?[jt]sx?|py|rs|go|java|cs|cpp|c|h|gd)$/i;
const typedCode = /\.[cm]?[jt]sx?$/i;
export interface ContextSelection {
  editable: ToolFile[]; readOnly: ToolFile[];
  summary: { path: string; role: 'editable' | 'read_only'; fileRole?: FileRole; reason: string; bytes: number }[];
  scannedFiles: number; scannedBytes: number; omitted: number; limitations: string[];
  omissions: { path: string; reason: string }[];
  dependencies?: DependencyGraph;
}

/** Resolves repository-relative imports against known, approved paths; never opens a package or executes config. */
export function resolveContextImport(file: string, specifier: string, known: Set<string>, policy?: WorkspaceFilePolicy): string | undefined {
  if (!specifier.startsWith('.') || specifier.includes('\\')) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
  if (base === '..' || base.startsWith('../') || path.posix.isAbsolute(base)) return undefined;
  const extensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'];
  const mapped = /\.[cm]?js$/.test(base) ? extensions.map(extension => base.replace(/\.[cm]?js$/, extension)) : [];
  return [base, ...mapped, ...extensions.map(extension => base + extension), ...extensions.map(extension => `${base}/index${extension}`)].find(candidate => known.has(candidate) && allowedToolPath(candidate, policy));
}

export function selectAutomaticContext(root: string, selected: ToolFile[], newFiles: ToolFile[], message: string, automatic = true,
  options: { filePolicy?: WorkspaceFilePolicy; readOnly?: boolean } = {}): ContextSelection {
  const policy = options.filePolicy;
  const gateway = new ApprovedRepositoryGateway(root, { maxFiles: 5000, maxReadBytes: 32000, filePolicy: policy });
  const source = (file: string) => policy ? policy.canReadText(file) : code.test(file);
  const omissions: ContextSelection['omissions'] = [];
  const omit = (file: string, reason: string) => { omitted++; if (omissions.length < 100) omissions.push({ path: file, reason }); };
  const aliasLimitations = new Set<string>();
  const hints = [...selected, ...newFiles].map(file => file.path);
  for (const match of message.matchAll(policy ? /[\w./-]+\.[a-z0-9]+\b/gi : /[\w./-]+\.[cm]?[jt]sx?\b/g)) {
    try { hints.push(gateway.describePath(match[0], 'file').path); } catch { /* Hints never bypass repository policy. */ }
  }
  const nearby = hints.flatMap(file => { try { return gateway.listFiles(path.posix.dirname(file), 600); } catch { return []; } });
  const repositoryFiles = gateway.listFiles('.', 3000);
  if (repositoryFiles.length === 3000 || nearby.length >= Math.max(1, hints.length) * 600) aliasLimitations.add('File discovery reached its directory/root cap; missing dependencies require a narrower explicit selection.');
  const known = new Set([...hints, ...nearby, ...repositoryFiles].filter(file => allowedToolPath(file, policy)));
  const records = new Map(selected.map(file => [file.path, file]));
  let scannedFiles = 0, scannedBytes = 0, omitted = 0;
  const candidates = [...known].filter(source).sort((a, b) => {
    const distance = (file: string) => hints.includes(file) ? 0 : hints.some(seed => path.posix.dirname(seed) === path.posix.dirname(file)) ? 1 : 2;
    return distance(a) - distance(b) || a.localeCompare(b);
  });
  if (automatic) for (const file of candidates) {
    if (records.has(file)) continue;
    if (scannedFiles >= 400 || scannedBytes > 510976) { omit(file, 'Source discovery byte/file budget reached'); continue; }
    scannedFiles++;
    try {
      const record = gateway.readTextFile(file, Math.min(32000, 512000 - scannedBytes));
      scannedBytes += Buffer.byteLength(record.content);
      if (record.truncated || !source(record.path)) { omit(file, 'Source exceeds per-file scan budget'); continue; }
      records.set(record.path, { path: record.path, content: record.content, sha256: record.sha256 });
    } catch { omit(file, 'Source is inaccessible, excluded or not lossless UTF-8'); }
  }
  const lower = message.toLowerCase(), words = new Set(lower.match(/[a-z][a-z0-9_]{2,}/g) || []);
  const reasons = new Map(selected.map(file => [file.path, 'Explicitly selected for editing']));
  if (!selected.length && !newFiles.length && automatic) {
    const ranked = [...records.values()].filter(file => !policy || options.readOnly || policy.canEditText(file.path)).map(file => {
      const basename = path.posix.basename(file.path), stem = basename.replace(/\.[^.]+$/, '').toLowerCase();
      let score = lower.includes(file.path.toLowerCase()) || lower.includes(basename.toLowerCase()) ? 100 : words.has(stem) ? 20 : 0;
      if (/\.(?:test|spec)\.|(^|\/)__tests__\//.test(file.path) && !/\btests?\b/.test(lower)) score = 0;
      if (!score && typedCode.test(file.path)) {
        const source = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true);
        for (const statement of source.statements) if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name && words.has(statement.name.text.toLowerCase())) score = 15;
      }
      return { file, score };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path));
    if (!ranked.length) throw new CodingToolError('Name an implementation file or symbol in the task, or select files explicitly.');
    for (const item of ranked.slice(0, 3).filter(item => item.score >= ranked[0].score * 0.8)) {
      if (selected.reduce((sum, file) => sum + Buffer.byteLength(file.content), 0) + Buffer.byteLength(item.file.content) > 12000) continue;
      selected.push(item.file); reasons.set(item.file.path, 'Task matched this file or declared symbol');
    }
  }
  const working = [...selected, ...newFiles], editable = options.readOnly ? [] : working, readOnly: ToolFile[] = [];
  if (!working.length || working.length > 12) throw new CodingToolError('Select between one and twelve editable files.');
  if (policy && editable.some(file => !policy.canEditText(file.path))) throw new CodingToolError('This file role requires a dedicated writer.', 403);
  let bytes = editable.reduce((sum, file) => sum + Buffer.byteLength(file.content), 0);
  if (working.reduce((sum, file) => sum + Buffer.byteLength(file.content), 0) > 16000) throw new CodingToolError('Selected source exceeds the 16 KB coding context budget.', 413);
  const edges = new Map<string, string[]>();
  const virtualKnown = new Set([...known, ...newFiles.map(file => file.path)]);
  const resolveAlias = automatic ? createContextAliasResolver(root, gateway, virtualKnown, aliasLimitations) : () => undefined;
  for (const record of records.values()) if (typedCode.test(record.path)) {
    edges.set(record.path, ts.preProcessFile(record.content, true, true).importedFiles.map(item => resolveAlias(record.path, item.fileName) || resolveContextImport(record.path, item.fileName, virtualKnown, policy)).filter((file): file is string => !!file));
  }
  const dependencies = policy && automatic ? buildProjectDependencies([...records.values()], virtualKnown, policy) : undefined;
  for (const edge of dependencies?.edges || []) if (edge.to) edges.set(edge.from, [...(edges.get(edge.from) || []), edge.to]);
  const add = (file: string, reason: string) => {
    if (editable.some(item => item.path === file) || readOnly.some(item => item.path === file)) return;
    try {
      if (!source(file)) { omit(file, 'Dependency role permits metadata only; use the engine/asset/binary tool'); return; }
      const record = records.get(file) || captureFiles(root, [file], 16000, 16, policy, 'read')[0];
      const size = Buffer.byteLength(record.content);
      if (bytes + size > 16000 || editable.length + readOnly.length >= 12) { omit(file, 'Captured context budget (12 files / 16 KB) reached'); return; }
      readOnly.push(record); bytes += size; reasons.set(file, reason);
    } catch { omit(file, 'Dependency is unavailable or exceeds the context input budget'); }
  };
  if (options.readOnly) for (const file of selected) add(file.path, 'Explicitly selected read-only project context');
  if (automatic) {
    for (const record of records.values()) if (lower.includes(record.path.toLowerCase()) || lower.includes(path.posix.basename(record.path).toLowerCase())) add(record.path, 'Task names this supporting source file');
    for (const file of options.readOnly ? selected : editable) for (const dependency of edges.get(file.path) || []) add(dependency, `Referenced by ${file.path}`);
    for (const [file, dependencies] of edges) if ((options.readOnly ? selected : editable).some(seed => dependencies.includes(seed.path))) add(file, 'References a selected file (caller or test)');
    for (const seed of editable) for (const file of candidates) {
      const stem = path.posix.basename(seed.path).replace(/\.[^.]+$/, '');
      if (path.posix.basename(file).startsWith(`${stem}.`) && /\.(?:test|spec)\./.test(file)) add(file, `Related test for ${seed.path}`);
    }
    for (const file of [...readOnly]) for (const dependency of edges.get(file.path) || []) add(dependency, `Dependency of context file ${file.path}`);
    const captured = new Set([...editable, ...readOnly].map(file => file.path));
    for (const file of captured) for (const dependency of edges.get(file) || []) if (!captured.has(dependency) && !omissions.some(item => item.path === dependency)) omit(dependency, 'Dependency depth limit (two supporting levels) reached');
  }
  return { editable, readOnly, summary: [...editable, ...readOnly].map(file => ({ path: file.path,
    role: editable.includes(file) ? 'editable' : 'read_only', ...(policy ? { fileRole: policy.classify(file.path).role } : {}), reason: file.exists === false ? 'Explicitly named new file' : reasons.get(file.path) || 'Selected source', bytes: Buffer.byteLength(file.content) })),
    scannedFiles, scannedBytes, omitted, omissions, ...(dependencies ? { dependencies } : {}), limitations: automatic ? ['Context selection is bounded to 400 source files / 512 KB scanned, 12 captured files / 16 KB. Static source dependencies are followed; dynamic references and uncaptured metadata remain unresolved.', ...aliasLimitations, ...(dependencies?.limitations || [])] : ['Automatic context selection was disabled.'] };
}
