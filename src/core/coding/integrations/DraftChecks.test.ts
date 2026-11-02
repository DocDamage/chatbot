import fs from 'fs';
import os from 'os';
import path from 'path';
import { checkDraft } from './DraftChecks';
import { captureFiles, captureNewFiles, materialize } from './ToolWorkspace';
import { codingToolConfig } from './CodingToolConfig';
import { introducedDiagnostics } from './DraftDiagnostics';

describe('compiler and lint checks before proposal', () => {
  let root: string, job: string;
  const config = codingToolConfig(process.cwd());
  const write = (file: string, text: string) => { const output = path.join(root, file); fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, text); };
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-checks-')); job = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-check-job-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(job, { recursive: true, force: true }); });
  it('detects TypeScript type errors and contracts broken in unchanged callers', async () => {
    write('value.ts', "export function value(input: number): number { return input; }\n");
    write('caller.ts', "import { value } from './value'; export const result: number = value(2);\n");
    const files = captureFiles(root, ['value.ts', 'caller.ts']), workspace = materialize(job, files);
    fs.writeFileSync(path.join(workspace, 'value.ts'), "export function value(input: string): number { return 'wrong'; }\n");
    const result = await checkDraft(config, workspace, files, undefined, root);
    expect(result.compiler.baselineErrors).toBe(0);
    expect(result.errors.join('\n')).toContain('TS2322'); expect(result.errors.join('\n')).toContain('TS2345');
    expect(result.diagnostics.some(item => item.file === 'caller.ts')).toBe(true);
  }, 20000);
  it('rejects new undefined JavaScript names and ignores inline lint suppression', async () => {
    write('value.cjs', 'module.exports = input => input;\n');
    write('eslint.config.js', "require('node:fs').writeFileSync('EXECUTED', 'bad'); module.exports = [];\n");
    const files = captureFiles(root, ['value.cjs']), workspace = materialize(job, files);
    fs.writeFileSync(path.join(workspace, 'value.cjs'), '/* eslint-disable */\nmodule.exports = input => missingName(input);\n');
    const result = await checkDraft(config, workspace, files, undefined, root);
    expect(result.linter.status).toBe('failed'); expect(result.errors.join('\n')).toContain('no-undef');
    expect(fs.existsSync(path.join(root, 'EXECUTED'))).toBe(false);
  }, 20000);
  it('compares against baseline errors without treating old diagnostics as fixed', async () => {
    write('value.ts', "export const broken: number = 'old error';\nexport const valid = 1;\n");
    const files = captureFiles(root, ['value.ts']), workspace = materialize(job, files);
    fs.writeFileSync(path.join(workspace, 'value.ts'), "\nexport const broken: number = 'old error';\nexport const valid = 2;\n");
    const result = await checkDraft(config, workspace, files, undefined, root);
    expect(result.errors).toEqual([]); expect(result.compiler.baselineErrors).toBe(1); expect(result.compiler.currentErrors).toBe(1);
    const diagnostic = { tool: 'typescript' as const, file: 'x.ts', code: 'TS2322', message: 'same error' };
    expect(introducedDiagnostics([diagnostic], [{ ...diagnostic, line: 10 }, { ...diagnostic, line: 11 }])).toHaveLength(1);
    expect(introducedDiagnostics([{ ...diagnostic, anchor: 'const old: number = "bad";' }], [{ ...diagnostic, anchor: 'const replacement: number = "bad";' }])).toHaveLength(1);
  }, 20000);
  it('checks new files and rejects adding TypeScript suppression directives', async () => {
    const files = captureNewFiles(root, ['value.ts']), workspace = materialize(job, files);
    fs.writeFileSync(path.join(workspace, 'value.ts'), "// @ts-nocheck\nexport const broken: number = 'bad';\n");
    expect((await checkDraft(config, workspace, files, undefined, root)).errors.join('\n')).toContain('suppression directives');
  }, 20000);
  it('rejects nonexistent named Node core imports before tests can execute', async () => {
    write('property.test.cjs', 'const assert = require("node:assert/strict"); assert.equal(1, 1);');
    const files = captureFiles(root, ['property.test.cjs']), workspace = materialize(job, files);
    fs.writeFileSync(path.join(workspace, 'property.test.cjs'), 'const { assert } = require("node:assert/strict"); assert.equal(1, 1);');
    const result = await checkDraft(config, workspace, files, undefined, root);
    expect(result.errors.join('\n')).toContain('chatbot/node-core-exports'); expect(result.errors.join('\n')).toContain('assert is not an exported member');
  }, 20000);
  it('honors static tsconfig paths and strict settings while rejecting escaping config inheritance', async () => {
    write('tsconfig.json', '{"compilerOptions":{"strict":true,"baseUrl":".","paths":{"@lib/*":["lib/*"]}}}');
    write('lib/helper.ts', 'export const helper = (input: string): string => input;');
    write('main.ts', "import { helper } from '@lib/helper'; export const result = helper('ok');");
    const files = captureFiles(root, ['main.ts', 'lib/helper.ts']), workspace = materialize(job, files);
    fs.writeFileSync(path.join(workspace, 'main.ts'), "import { helper } from '@lib/helper'; export const result = helper(42);");
    const result = await checkDraft(config, workspace, files, undefined, root);
    expect(result.compiler.baselineErrors).toBe(0); expect(result.errors.join('\n')).toContain('TS2345');
    write('tsconfig.json', '{"extends":"../outside.json"}');
    await expect(checkDraft(config, workspace, files, undefined, root)).rejects.toThrow(/outside/);
  }, 20000);
});
