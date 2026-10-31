import path from 'path';
import ts from 'typescript';
import { ApprovedRepositoryGateway } from '../security/ApprovedRepositoryGateway';
import { CodingToolError } from './CodingToolConfig';

export function compilerSettings(root: string, file: string) {
  const gateway = new ApprovedRepositoryGateway(root, { maxReadBytes: 64000 });
  const notes: string[] = [], configs: string[] = [];
  const read = (relative: string): string | undefined => {
    try { const record = gateway.readTextFile(relative); if (record.truncated) throw new CodingToolError('Compiler config exceeds its read budget.'); return record.content; }
    catch (error: any) { if (error.code === 'ENOENT') return undefined; throw error; }
  };
  const load = (relative: string, visited = new Set<string>()): ts.CompilerOptions => {
    if (visited.has(relative) || visited.size >= 8) throw new CodingToolError('Cyclic or excessive TypeScript config inheritance.');
    visited.add(relative); const content = read(relative); if (content === undefined) { notes.push(`Unavailable compiler config: ${relative}`); return {}; }
    configs.push(relative);
    const parsed = ts.parseConfigFileTextToJson(relative, content);
    if (parsed.error) throw new CodingToolError(`Invalid compiler config ${relative}: ${ts.flattenDiagnosticMessageText(parsed.error.messageText, ' ')}`);
    let inherited: ts.CompilerOptions = {};
    for (const parent of typeof parsed.config.extends === 'string' ? [parsed.config.extends] : Array.isArray(parsed.config.extends) ? parsed.config.extends : []) {
      if (typeof parent !== 'string' || !parent.startsWith('.')) { notes.push(`Package config inheritance was not loaded: ${String(parent)}`); continue; }
      const parentFile = path.posix.normalize(path.posix.join(path.posix.dirname(relative), parent));
      inherited = { ...inherited, ...load(parentFile.endsWith('.json') ? parentFile : `${parentFile}.json`, new Set(visited)) };
    }
    const settings = { ...(parsed.config.compilerOptions || {}) };
    for (const key of ['plugins', 'rootDir', 'outDir', 'declaration', 'declarationDir', 'incremental', 'composite', 'tsBuildInfoFile']) delete settings[key];
    const converted = ts.convertCompilerOptionsFromJson(settings, path.resolve(root, path.dirname(relative)));
    if (converted.errors.length) notes.push(`Some compiler options could not be interpreted in ${relative}.`);
    const options = { ...inherited, ...converted.options };
    if (options.paths && !options.baseUrl) options.baseUrl = path.resolve(root, path.dirname(relative));
    return options;
  };
  let directory = path.posix.dirname(file), nearest: string | undefined;
  for (let depth = 0; depth < 100; depth++) {
    const candidate = path.posix.join(directory, 'tsconfig.json');
    if (read(candidate) !== undefined) { nearest = candidate; break; }
    if (directory === '.') break; directory = path.posix.dirname(directory);
  }
  const configured = nearest ? load(nearest) : {};
  return { options: { strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    ...configured, allowJs: true, checkJs: configured.checkJs ?? false, noEmit: true, skipLibCheck: true,
    ignoreDeprecations: '5.0' } as ts.CompilerOptions, configs, notes };
}
