import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { ToolFile } from './ToolWorkspace';
import { runTool } from './ToolProcess';
import { CodingToolConfig } from './CodingToolConfig';

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

/** Syntax checks do not execute the selected code. Import checks cover new literal CommonJS references only. */
export async function checkDraft(config: CodingToolConfig, workspace: string, files: ToolFile[], signal?: AbortSignal): Promise<string[]> {
  const errors: string[] = [];
  const env: NodeJS.ProcessEnv = {};
  for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']) if (process.env[key]) env[key] = process.env[key];
  for (const file of files) {
    if (!/\.[cm]?js$/i.test(file.path)) continue;
    const absolute = path.join(workspace, file.path), content = fs.readFileSync(absolute, 'utf8');
    if (content === file.content) continue;
    const syntax = await runTool(config.node, ['--check', absolute], workspace, 10000, env, signal);
    if (syntax.exitCode !== 0) errors.push(`${file.path}: ${syntax.stderr.slice(-2400)}`);
    const previous = new Set(localRequires(file.content));
    for (const specifier of localRequires(content).filter(value => !previous.has(value))) {
      const base = path.resolve(path.dirname(absolute), specifier), relative = path.relative(workspace, base);
      if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep)) { errors.push(`${file.path}: new require(${JSON.stringify(specifier)}) escapes the selected snapshot.`); continue; }
      const candidates = [base, ...['.js', '.json', '.node', '/index.js', '/index.json', '/index.node'].map(suffix => base + suffix)];
      if (!candidates.some(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())) {
        errors.push(`${file.path}: new require(${JSON.stringify(specifier)}) has no selected target. Node CommonJS does not infer .cjs; include its exact extension. Do not create undeclared files.`);
      }
    }
  }
  return errors;
}
