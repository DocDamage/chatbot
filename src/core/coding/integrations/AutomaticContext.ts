import path from 'path';
import ts from 'typescript';
import crypto from 'crypto';
import { ApprovedRepositoryGateway } from '../security/ApprovedRepositoryGateway';
import { allowedToolPath, captureFiles, ToolFile } from './ToolWorkspace';
import { CodingToolError } from './CodingToolConfig';

const code = /\.(?:[cm]?[jt]sx?|py|rs|go|java|cs|cpp|c|h|gd)$/i;
const typedCode = /\.[cm]?[jt]sx?$/i;
export interface ContextSelection {
  editable: ToolFile[]; readOnly: ToolFile[];
  summary: { path: string; role: 'editable' | 'read_only'; reason: string; bytes: number }[];
  scannedFiles: number; scannedBytes: number; omitted: number; limitations: string[];
}

/** Resolves repository-relative imports against known, approved paths; never opens a package or executes config. */
export function resolveContextImport(file: string, specifier: string, known: Set<string>): string | undefined {
  if (!specifier.startsWith('.') || specifier.includes('\\')) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
  if (base === '..' || base.startsWith('../') || path.posix.isAbsolute(base)) return undefined;
  const extensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'];
  const mapped = /\.[cm]?js$/.test(base) ? extensions.map(extension => base.replace(/\.[cm]?js$/, extension)) : [];
  return [base, ...mapped, ...extensions.map(extension => base + extension), ...extensions.map(extension => `${base}/index${extension}`)].find(candidate => known.has(candidate) && allowedToolPath(candidate));
}

export function selectAutomaticContext(root: string, selected: ToolFile[], newFiles: ToolFile[], message: string, automatic = true): ContextSelection {
  const gateway = new ApprovedRepositoryGateway(root, { maxFiles: 5000, maxReadBytes: 32000 });
  const hints = [...selected, ...newFiles].map(file => file.path);
  for (const match of message.matchAll(/[\w./-]+\.[cm]?[jt]sx?\b/g)) {
    try { hints.push(gateway.describePath(match[0], 'file').path); } catch { /* Hints never bypass repository policy. */ }
  }
  const nearby = hints.flatMap(file => { try { return gateway.listFiles(path.posix.dirname(file), 600); } catch { return []; } });
  const known = new Set([...hints, ...nearby, ...gateway.listFiles('.', 3000)].filter(file => allowedToolPath(file)));
  const records = new Map(selected.map(file => [file.path, file]));
  let scannedFiles = 0, scannedBytes = 0, omitted = 0;
  const candidates = [...known].filter(file => code.test(file)).sort((a, b) => {
    const distance = (file: string) => hints.includes(file) ? 0 : hints.some(seed => path.posix.dirname(seed) === path.posix.dirname(file)) ? 1 : 2;
    return distance(a) - distance(b) || a.localeCompare(b);
  });
  if (automatic) for (const file of candidates) {
    if (records.has(file)) continue;
    if (scannedFiles >= 400 || scannedBytes > 510976) { omitted++; continue; }
    scannedFiles++;
    try {
      const record = gateway.readTextFile(file, Math.min(32000, 512000 - scannedBytes));
      scannedBytes += Buffer.byteLength(record.content);
      if (record.truncated || !code.test(record.path)) { omitted++; continue; }
      records.set(record.path, { path: record.path, content: record.content, sha256: crypto.createHash('sha256').update(record.content).digest('hex') });
    } catch { omitted++; }
  }
  const lower = message.toLowerCase(), words = new Set(lower.match(/[a-z][a-z0-9_]{2,}/g) || []);
  const reasons = new Map(selected.map(file => [file.path, 'Explicitly selected for editing']));
  if (!selected.length && !newFiles.length && automatic) {
    const ranked = [...records.values()].map(file => {
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
  const editable = [...selected, ...newFiles], readOnly: ToolFile[] = [];
  if (!editable.length || editable.length > 12) throw new CodingToolError('Select between one and twelve editable files.');
  let bytes = editable.reduce((sum, file) => sum + Buffer.byteLength(file.content), 0);
  if (bytes > 16000) throw new CodingToolError('Selected source exceeds the 16 KB coding context budget.', 413);
  const edges = new Map<string, string[]>();
  const virtualKnown = new Set([...known, ...newFiles.map(file => file.path)]);
  for (const record of records.values()) if (typedCode.test(record.path)) {
    edges.set(record.path, ts.preProcessFile(record.content, true, true).importedFiles.map(item => resolveContextImport(record.path, item.fileName, virtualKnown)).filter((file): file is string => !!file));
  }
  const add = (file: string, reason: string) => {
    if (editable.some(item => item.path === file) || readOnly.some(item => item.path === file)) return;
    try {
      const record = records.get(file) || captureFiles(root, [file], 16000)[0];
      const size = Buffer.byteLength(record.content);
      if (bytes + size > 16000 || editable.length + readOnly.length >= 12) { omitted++; return; }
      readOnly.push(record); bytes += size; reasons.set(file, reason);
    } catch { omitted++; }
  };
  if (automatic) {
    for (const record of records.values()) if (lower.includes(record.path.toLowerCase()) || lower.includes(path.posix.basename(record.path).toLowerCase())) add(record.path, 'Task names this supporting source file');
    for (const file of editable) for (const dependency of edges.get(file.path) || []) add(dependency, `Imported by ${file.path}`);
    for (const [file, dependencies] of edges) if (editable.some(seed => dependencies.includes(seed.path))) add(file, 'Imports an editable file (caller or test)');
    for (const seed of editable) for (const file of candidates) {
      const stem = path.posix.basename(seed.path).replace(/\.[^.]+$/, '');
      if (path.posix.basename(file).startsWith(`${stem}.`) && /\.(?:test|spec)\./.test(file)) add(file, `Related test for ${seed.path}`);
    }
    for (const file of [...readOnly]) for (const dependency of edges.get(file.path) || []) add(dependency, `Dependency of context file ${file.path}`);
  }
  return { editable, readOnly, summary: [...editable, ...readOnly].map(file => ({ path: file.path,
    role: editable.includes(file) ? 'editable' : 'read_only', reason: file.exists === false ? 'Explicitly named new file' : reasons.get(file.path) || 'Selected source', bytes: Buffer.byteLength(file.content) })),
    scannedFiles, scannedBytes, omitted, limitations: automatic ? ['Context selection is bounded to 400 source files / 512 KB scanned, 12 captured files / 16 KB. Relative JavaScript/TypeScript imports, importing callers and related tests are followed; package aliases and other language imports may require explicit files.'] : ['Automatic context selection was disabled.'] };
}
