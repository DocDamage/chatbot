import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { ToolFile } from './ToolWorkspace';
import { runTool } from './ToolProcess';
import { CodingToolConfig } from './CodingToolConfig';
import { CodingToolError } from './CodingToolConfig';
import { compileSnapshot } from './CompilerChecks';
import { DraftDiagnostic, introducedDiagnostics, formatDraftDiagnostic } from './DraftDiagnostics';

function localRequires(content: string): string[] {
  const source = ts.createSourceFile('source.js', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const result: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require'
      && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text.startsWith('.')) result.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(source); return result;
}

/** Fixed static checks over captured originals and draft copies; source and project JS config are never executed. */
export async function checkDraft(config: CodingToolConfig, workspace: string, files: ToolFile[], signal?: AbortSignal, repositoryRoot = config.root) {
  if (signal?.aborted) throw new CodingToolError('Coding tool cancelled.', 409);
  const errors: string[] = [];
  const env: NodeJS.ProcessEnv = {};
  for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']) if (process.env[key]) env[key] = process.env[key];
  let outputBytes = 0;
  const after = files.map(file => {
    const absolute = path.join(workspace, file.path), stat = fs.lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink() || (outputBytes += stat.size) > 64000) throw new CodingToolError('Draft source exceeded its static-check boundary.', 413);
    return { ...file, content: fs.readFileSync(absolute, 'utf8') };
  });
  for (const file of after) {
    const original = files.find(item => item.path === file.path)!;
    const absolute = path.join(workspace, file.path), content = fs.readFileSync(absolute, 'utf8');
    if (content === original.content) continue;
    const suppression = /@ts-(?:nocheck|ignore|expect-error)\b/g;
    if ([...content.matchAll(suppression)].length > [...original.content.matchAll(suppression)].length) errors.push(`${file.path}: new TypeScript suppression directives cannot bypass draft validation.`);
    if (!/\.[cm]?js$/i.test(file.path)) continue;
    const syntax = await runTool(config.node, ['--check', absolute], workspace, 10000, env, signal);
    if (syntax.exitCode !== 0) errors.push(`${file.path}: ${syntax.stderr.slice(-2400)}`);
    const previous = new Set(localRequires(original.content));
    for (const specifier of localRequires(content).filter(value => !previous.has(value))) {
      const base = path.resolve(path.dirname(absolute), specifier), relative = path.relative(workspace, base);
      if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep)) { errors.push(`${file.path}: new require(${JSON.stringify(specifier)}) escapes the selected snapshot.`); continue; }
      const candidates = [base, ...['.js', '.json', '.node', '/index.js', '/index.json', '/index.node'].map(suffix => base + suffix)];
      if (!candidates.some(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())) {
        errors.push(`${file.path}: new require(${JSON.stringify(specifier)}) has no selected target. Node CommonJS does not infer .cjs; include its exact extension. Do not create undeclared files.`);
      }
    }
  }
  const beforeCompiler = compileSnapshot(repositoryRoot, files), afterCompiler = compileSnapshot(repositoryRoot, after);
  const compilerDiagnostics = introducedDiagnostics(beforeCompiler.diagnostics, afterCompiler.diagnostics);
  const eligible = files.filter(file => /\.[cm]?[jt]sx?$/i.test(file.path));
  let beforeLint: DraftDiagnostic[] = [], afterLint: DraftDiagnostic[] = [], lintVersion: string | undefined;
  if (eligible.length) {
    const request = path.join(path.dirname(workspace), 'lint-request.json');
    fs.writeFileSync(request, JSON.stringify({ files: eligible.map(file => ({ path: file.path, before: file.content, after: after.find(item => item.path === file.path)!.content })) }));
    const lint = await runTool(config.node, [path.join(config.root, 'scripts/coding/lint-worker.cjs'), request], workspace, 20000, env, signal);
    if (lint.exitCode !== 0) throw new CodingToolError(`Draft linter unavailable. Run npm run setup:coding-tools. ${lint.stderr.slice(-1000)}`, 503);
    const result = JSON.parse(lint.stdout); beforeLint = result.before; afterLint = result.after; lintVersion = result.version;
  }
  const lintDiagnostics = introducedDiagnostics(beforeLint, afterLint);
  const diagnostics = [...compilerDiagnostics, ...lintDiagnostics];
  errors.push(...diagnostics.map(formatDraftDiagnostic));
  if (signal?.aborted) throw new CodingToolError('Coding tool cancelled.', 409);
  return { errors, diagnostics, compiler: { status: eligible.length ? compilerDiagnostics.length ? 'failed' : 'passed' : 'not_applicable',
    baselineErrors: beforeCompiler.diagnostics.length, currentErrors: afterCompiler.diagnostics.length, configurations: afterCompiler.configurations },
    linter: { status: eligible.length ? lintDiagnostics.length ? 'failed' : 'passed' : 'not_applicable', version: lintVersion,
      baselineErrors: beforeLint.length, currentErrors: afterLint.length },
    limitations: [...afterCompiler.limitations, 'Checks detect newly introduced errors within the captured JavaScript/TypeScript source and read-only context, using available project declarations. Baseline snapshot diagnostics are counted, not silently claimed fixed; they can include unresolved imports from omitted dependencies rather than actual project defects.',
      'The fixed ESLint correctness profile does not load project plugins or JavaScript configuration. Run full project verification after applying. Other languages do not receive these compiler/linter checks.'] };
}
