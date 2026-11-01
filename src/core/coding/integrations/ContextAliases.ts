import path from 'path';
import ts from 'typescript';
import { ApprovedRepositoryGateway } from '../security/ApprovedRepositoryGateway';
import { allowedToolPath } from './ToolWorkspace';

/** Static config reads use the gateway; module resolution sees only approved, discovered paths. */
export function createContextAliasResolver(root: string, gateway: ApprovedRepositoryGateway, known: Set<string>, notes: Set<string>) {
  const absoluteRoot = path.resolve(root);
  const configs = new Map<string, string | undefined>();
  const boundaries = new Set<string>();
  const nearest = new Map<string, string | undefined>();
  const options = new Map<string, ts.CompilerOptions>();
  let probes = 0, files = 0, bytes = 0;
  const invalid = () => notes.add('TypeScript alias configuration was unavailable or invalid; relative imports remain available.');
  const limited = () => notes.add('TypeScript alias configuration reached its safety budget; affected aliases may need explicit files.');
  const rejected = () => notes.add('Some TypeScript path aliases or configuration paths were rejected by repository policy.');
  const relative = (absolute: string): string | undefined => {
    const file = path.relative(absoluteRoot, absolute).replace(/\\/g, '/');
    return !path.isAbsolute(file) && file !== '..' && !file.startsWith('../') && allowedToolPath(file) ? file : undefined;
  };
  const read = (absolute: string): string | undefined => {
    if (configs.has(absolute)) return configs.get(absolute);
    if (++probes > 512) { limited(); boundaries.add(absolute); return undefined; }
    const file = relative(absolute);
    if (file === undefined || !file.endsWith('.json')) { rejected(); boundaries.add(absolute); configs.set(absolute, undefined); return undefined; }
    let text: string | undefined;
    try {
      const info = gateway.describePath(file, 'file');
      boundaries.add(absolute);
      if (files >= 16 || info.size > 32000 || bytes + info.size > 128000) limited();
      else {
        const record = gateway.readTextFile(file, 32000);
        files++; bytes += record.size;
        if (record.truncated) limited();
        else text = record.content;
      }
    } catch (error: any) { if (error.code !== 'ENOENT') { boundaries.add(absolute); invalid(); } }
    configs.set(absolute, text);
    return text;
  };
  const configFor = (file: string): string | undefined => {
    let directory = path.dirname(path.resolve(absoluteRoot, file));
    const visited: string[] = [];
    while (relative(directory) !== undefined) {
      if (nearest.has(directory)) {
        const cached = nearest.get(directory);
        visited.forEach(item => nearest.set(item, cached));
        return cached;
      }
      visited.push(directory);
      const candidate = path.join(directory, 'tsconfig.json');
      // An existing invalid/blocked config remains the nearest boundary; do not use an ancestor silently.
      if (read(candidate) !== undefined || boundaries.has(candidate)) {
        visited.forEach(item => nearest.set(item, candidate));
        return candidate;
      }
      if (directory === absoluteRoot) break;
      directory = path.dirname(directory);
    }
    visited.forEach(item => nearest.set(item, undefined));
    return undefined;
  };
  const settings = (config: string): ts.CompilerOptions => {
    const cached = options.get(config);
    if (cached) return cached;
    const content = read(config);
    let result: ts.CompilerOptions = {};
    if (content !== undefined) try {
      const configName = config.replace(/\\/g, '/');
      const parsed = ts.parseConfigFileTextToJson(configName, content);
      if (parsed.error || !parsed.config || typeof parsed.config !== 'object' || Array.isArray(parsed.config)) invalid();
      else {
        const parsedOptions = ts.parseJsonConfigFileContent(parsed.config, {
          useCaseSensitiveFileNames: true, readDirectory: () => [],
          fileExists: file => read(path.resolve(file)) !== undefined,
          readFile: file => read(path.resolve(file))
        }, path.dirname(config), undefined, configName);
        if (parsedOptions.errors.some(error => error.code !== 18002 && error.code !== 18003)) invalid();
        else result = parsedOptions.options;
      }
    } catch { invalid(); }
    const mappings = Object.entries(result.paths || {});
    if (mappings.length > 64 || mappings.some(([, targets]) => targets.length > 16)) { limited(); result = {}; }
    const base = result.baseUrl || (result as ts.CompilerOptions & { pathsBasePath?: string }).pathsBasePath || path.dirname(config);
    if (relative(path.resolve(base)) === undefined) rejected();
    for (const [, targets] of Object.entries(result.paths || {})) {
      if (targets.some(target => relative(path.resolve(base, target)) === undefined)) rejected();
    }
    options.set(config, result);
    return result;
  };
  const directories = new Set<string>();
  for (const file of known) {
    let directory = path.dirname(path.resolve(absoluteRoot, file));
    while (!directories.has(directory) && relative(directory) !== undefined) {
      directories.add(directory);
      if (directory === absoluteRoot) break;
      directory = path.dirname(directory);
    }
  }
  const host: ts.ModuleResolutionHost = {
    fileExists: absolute => { const file = relative(path.resolve(absolute)); return file !== undefined && known.has(file); },
    readFile: () => undefined,
    directoryExists: directory => directories.has(path.resolve(directory)),
    getCurrentDirectory: () => absoluteRoot
  };
  return (file: string, specifier: string): string | undefined => {
    const config = configFor(file);
    if (!config) return undefined;
    const compiler = settings(config);
    if (specifier.startsWith('.') || path.isAbsolute(specifier) || specifier.includes('\\')) return undefined;
    if (!compiler.paths && !compiler.baseUrl) return undefined;
    const resolved = ts.resolveModuleName(specifier, path.resolve(absoluteRoot, file), {
      moduleResolution: ts.ModuleResolutionKind.Node10, ...compiler
    }, host).resolvedModule;
    if (!resolved) return undefined;
    const target = relative(resolved.resolvedFileName);
    return target !== undefined && known.has(target) ? target : undefined;
  };
}
