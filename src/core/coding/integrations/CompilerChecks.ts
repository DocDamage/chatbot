import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { isSensitiveWorkspacePath } from '../security/WorkspacePathPolicy';
import { ToolFile } from './ToolWorkspace';
import { compilerSettings } from './CompilerSettings';
import { DraftDiagnostic } from './DraftDiagnostics';
import { CodingToolError } from './CodingToolConfig';

export function compileSnapshot(root: string, files: ToolFile[]) {
  const sources = new Map(files.filter(file => /\.(?:[cm]?[jt]sx?|json)$/.test(file.path)).map(file => [path.resolve(root, file.path), file.content]));
  const groups = new Map<string, { settings: ReturnType<typeof compilerSettings>; roots: string[] }>();
  for (const absolute of sources.keys()) {
    if (!/\.[cm]?[jt]sx?$/.test(absolute)) continue;
    const settings = compilerSettings(root, path.relative(root, absolute).replace(/\\/g, '/'));
    const key = JSON.stringify(settings.options);
    const group = groups.get(key) || { settings, roots: [] }; group.roots.push(absolute); groups.set(key, group);
  }
  if (groups.size > 4) throw new CodingToolError('Select source from at most four TypeScript project configurations.');
  const library = path.dirname(require.resolve('typescript'));
  const packages = path.join(path.resolve(root), 'node_modules');
  const within = (parent: string, file: string) => { const relative = path.relative(parent, file); return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`); };
  let readBytes = 0, readFiles = 0;
  const declarations = new Map<string, string | undefined>();
  const permitted = (file: string) => {
    const absolute = path.resolve(file);
    if (sources.has(absolute)) return true;
    if (!within(library, absolute) && (!within(packages, absolute) || !/(?:\.d\.[cm]?ts|\.json)$/.test(absolute))) return false;
    if (isSensitiveWorkspacePath(path.relative(root, absolute))) return false;
    try { return within(within(library, absolute) ? library : packages, fs.realpathSync(absolute)); } catch { return false; }
  };
  const readFile = (file: string): string | undefined => {
    const absolute = path.resolve(file); if (sources.has(absolute)) return sources.get(absolute);
    if (!permitted(absolute)) return undefined;
    if (!declarations.has(absolute)) {
      const stat = fs.statSync(absolute);
      if (!stat.isFile()) return undefined;
      if (++readFiles > 2500 || (readBytes += stat.size) > 16000000) throw new CodingToolError('Type declaration input exceeded its compiler budget.', 413);
      declarations.set(absolute, fs.readFileSync(absolute, 'utf8'));
    }
    return declarations.get(absolute);
  };
  const diagnostics: DraftDiagnostic[] = [], notes: string[] = [], configs = new Set<string>();
  for (const { settings, roots } of groups.values()) {
    settings.configs.forEach(file => configs.add(file)); notes.push(...settings.notes);
    const host = ts.createCompilerHost(settings.options);
    host.readFile = readFile; host.fileExists = file => sources.has(path.resolve(file)) || permitted(file);
    host.getSourceFile = (file, target) => { const text = readFile(file); return text === undefined ? undefined : ts.createSourceFile(file, text, target, true); };
    host.getCurrentDirectory = () => path.resolve(root); host.writeFile = () => {};
    host.directoryExists = directory => [...sources.keys()].some(file => within(path.resolve(directory), file))
      || (within(packages, path.resolve(directory)) && fs.existsSync(directory));
    host.getDirectories = directory => {
      if (!within(packages, path.resolve(directory)) || !fs.existsSync(directory)) return [];
      return fs.readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory()).slice(0, 200).map(entry => entry.name);
    };
    const program = ts.createProgram(roots, settings.options, host);
    for (const item of ts.getPreEmitDiagnostics(program)) {
      if (item.category !== ts.DiagnosticCategory.Error) continue;
      if (item.file && !sources.has(path.resolve(item.file.fileName))) continue;
      const point = item.file && item.start !== undefined ? item.file.getLineAndCharacterOfPosition(item.start) : undefined;
      diagnostics.push({ tool: 'typescript', file: item.file ? path.relative(root, item.file.fileName).replace(/\\/g, '/') : '(compiler options)',
        line: point ? point.line + 1 : undefined, column: point ? point.character + 1 : undefined,
        code: `TS${item.code}`, message: ts.flattenDiagnosticMessageText(item.messageText, ' ').slice(0, 1800),
        anchor: item.file && point ? item.file.text.split(/\r?\n/)[point.line]?.trim().slice(0, 600) : undefined });
    }
  }
  const unique = [...new Map(diagnostics.map(item => [JSON.stringify(item), item])).values()];
  return { diagnostics: unique, configurations: [...configs], limitations: [...new Set(notes)] };
}
