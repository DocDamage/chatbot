import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import crypto from 'crypto';
import { CodingToolsService } from '../../src/core/coding/integrations/CodingToolsService';
import { codingToolConfig } from '../../src/core/coding/integrations/CodingToolConfig';
import { CodingAgent } from '../../src/core/agents/CodingAgent';
import { OllamaAdapter } from '../../src/core/providers/OllamaAdapter';
import { VerificationOrchestrator } from '../../src/core/coding/verification/VerificationOrchestrator';
import { StructuredEditEngine } from '../../src/core/coding/editing/StructuredEditEngine';
import { validatePatchDraft } from '../../src/core/coding/integrations/PatchDraftValidator';
import { captureFiles } from '../../src/core/coding/integrations/ToolWorkspace';

// Explicit live evaluation. Every editable repository is an isolated fixture under data/.
const root = process.cwd(), config = codingToolConfig(root);
const directory = fs.mkdtempSync(path.join(root, 'data/coding-tools/evaluation-'));
const checks: any[] = [];
const caseFilter = process.argv.find(argument => argument.startsWith('--case='))?.slice(7).toLowerCase();
const digest = (text: string) => crypto.createHash('sha256').update(text).digest('hex');
function fixture(name: string, files: Record<string, string>) {
  const workspace = path.join(directory, name); fs.mkdirSync(workspace, { recursive: true });
  for (const [file, content] of Object.entries(files)) { const output = path.join(workspace, file); fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, content); }
  return workspace;
}
async function check(name: string, work: () => Promise<unknown>) {
  if (caseFilter && !name.toLowerCase().includes(caseFilter)) return;
  const started = Date.now(); console.log(`Running ${name}`);
  try { const evidence = await work(); checks.push({ name, status: 'passed', durationMs: Date.now() - started, evidence }); console.log(`Passed ${name}`); }
  catch (error: any) { checks.push({ name, status: 'failed', durationMs: Date.now() - started, error: error.message }); console.error(`Failed ${name}: ${error.message.slice(0, 1000)}`); }
  fs.writeFileSync(path.join(directory, 'verification.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), model: config.model, workspace: directory, checks }, null, 2));
}
async function verify(workspace: string) {
  const result = await new VerificationOrchestrator(workspace).verify();
  assert.equal(result.status, 'passed', JSON.stringify(result));
  assert.ok(result.results.some(result => result.status === 'passed'));
  return result.results.map(result => ({ command: result.command, exitCode: result.exitCode }));
}
async function aiderCase(name: string, files: Record<string, string>, selected: string[], task: string, newFiles?: string[], extra: { propertyTests?: boolean } = {}) {
  const workspace = fixture(name, files), tools = new CodingToolsService(workspace, { ...config, enabled: true });
  const original = Object.fromEntries(Object.entries(files).map(([file, value]) => [file, digest(value)]));
  const documentation = name === 'aider-tests' ? { library: '/nodejs/node', query: 'CommonJS examples of node:test test(name, fn) and node:assert/strict. Explain TestContext methods and synchronous top-level tests without Tape APIs.' } : undefined;
  const result = await tools.propose('live-evaluation', { files: selected, newFiles, message: task, documentation, ...extra });
  for (const [file, hash] of Object.entries(original)) assert.equal(digest(fs.readFileSync(path.join(workspace, file), 'utf8')), hash, 'Proposal must not edit the real fixture.');
  assert.ok(result.operations.length > 0); assert.ok(result.operations.every(operation => !operation.authorized));
  let negativeValidation: unknown;
  if (name === 'aider-type-context') {
    assert.ok(result.selection.files.some(file => file.path === 'round.ts' && file.role === 'read_only'));
    assert.ok(result.selection.files.some(file => file.path === 'use.ts' && file.role === 'read_only'));
    assert.equal(result.draftChecks.compiler?.status, 'passed'); assert.equal(result.draftChecks.linter?.status, 'passed');
    const invalid = await validatePatchDraft(config, workspace, captureFiles(workspace, ['format.ts', 'round.ts', 'use.ts']), [{
      operation: 'modify', path: 'format.ts', content: 'export function formatAmount(value: number): string { return value; }', reason: 'Negative validation probe', authorized: false }]);
    assert.ok(invalid.errors.some(error => error.includes('TS2322')));
    const lint = await validatePatchDraft(config, workspace, captureFiles(workspace, ['check.cjs']), [{
      operation: 'modify', path: 'check.cjs', content: 'module.exports = value => absentName(value);', reason: 'Negative lint probe', authorized: false }]);
    assert.ok(lint.errors.some(error => error.includes('no-undef')));
    negativeValidation = { typeErrorRejected: true, undefinedNameRejected: true };
  }
  const operations = result.operations.map(operation => ({ ...operation, authorized: true }));
  const engine = new StructuredEditEngine(workspace); engine.apply(engine.createPatch(operations));
  const firstVerification = await new VerificationOrchestrator(workspace).verify();
  let repair: any;
  if (firstVerification.status === 'failed') {
    repair = await new CodingAgent({ workspaceRoot: workspace }).repair({ mode: 'debug', operations,
      alreadyApplied: true, modelAdapter: new OllamaAdapter(config.ollamaUrl, config.model), message: task, maxIterations: 3,
      referenceContext: result.documentation?.content, contextFiles: result.selection.files.map(file => file.path) });
    assert.equal(repair.status, 'passed', JSON.stringify(repair));
  }
  const commands = await verify(workspace);
  // Tests are held outside the worker's edit scope.
  const editable = new Set(result.selection.files.filter(file => file.role === 'editable').map(file => file.path));
  for (const [file, hash] of Object.entries(original).filter(([file]) => !editable.has(file))) assert.equal(digest(fs.readFileSync(path.join(workspace, file), 'utf8')), hash);
  if (name === 'aider-tests') {
    const source = path.join(workspace, 'clamp.cjs'), originalSource = fs.readFileSync(source, 'utf8');
    try {
      fs.writeFileSync(source, 'module.exports = () => 0;\n');
      assert.equal((await new VerificationOrchestrator(workspace).verify()).status, 'failed', 'Generated tests must catch a deliberately broken implementation.');
    } finally { fs.writeFileSync(source, originalSource); }
  }
  const propertyMutations: string[] = [];
  if (name === 'aider-properties') {
    const source = path.join(workspace, 'reverse.cjs'), originalSource = fs.readFileSync(source, 'utf8');
    try {
      for (const [label, code] of [['identity', 'module.exports = values => values;'], ['mutates input', 'module.exports = values => values.reverse();'], ['empty output', 'module.exports = () => [];']]) {
        fs.writeFileSync(source, code);
        assert.equal((await new VerificationOrchestrator(workspace).verify()).status, 'failed', `Generated property tests must detect ${label}.`);
        propertyMutations.push(label);
      }
    } finally { fs.writeFileSync(source, originalSource); }
  }
  return { runId: result.runId, model: result.model, changedFiles: result.operations.map(operation => operation.path),
    firstVerification: firstVerification.status, repairRounds: repair?.attempts.length || 0, draftChecks: result.draftChecks, selection: result.selection,
    negativeValidation, propertyMutations, mutationDetected: name === 'aider-tests' ? true : undefined, commands };
}

async function main() {
  await check('Serena follows a TypeScript import alias', async () => {
    const workspace = fixture('references', {
      'calc.ts': 'export function add(a: number, b: number) { return a + b; }\n',
      'use.ts': "import { add as sum } from './calc';\nexport function total() { return sum(2, 3); }\n",
      'tsconfig.json': '{"compilerOptions":{"strict":true,"module":"commonjs","target":"ES2022"},"include":["*.ts"]}',
    });
    const result = await new CodingToolsService(workspace, { ...config, enabled: true }).references('live-evaluation', { files: ['calc.ts', 'use.ts'], file: 'calc.ts', symbol: 'add' });
    assert.ok(result.definition.content.includes('add')); assert.ok(result.references.content.includes('use.ts'), result.references.content);
    return { runId: result.runId, provider: result.provider, references: result.references.content };
  });
  await check('ast-grep previews and applies a structural repair', async () => {
    const workspace = fixture('structural', { 'package.json': '{"scripts":{"test":"node --test check.cjs"}}',
      'calc.cjs': 'module.exports = (a, b) => a - b;\n', 'check.cjs': "const {test}=require('node:test'); const assert=require('node:assert/strict'); const add=require('./calc.cjs'); test('addition',()=>{assert.equal(add(2,3),5);assert.equal(add(-2,3),1);});" });
    const result = await new CodingToolsService(workspace, { ...config, enabled: true }).structural('live-evaluation', { files: ['calc.cjs'], pattern: '$A - $B', rewrite: '$A + $B', language: 'javascript' });
    assert.equal(result.operations.length, 1); assert.ok(!fs.readFileSync(path.join(workspace, 'calc.cjs'), 'utf8').includes('a + b'));
    const engine = new StructuredEditEngine(workspace); engine.apply(engine.createPatch(result.operations.map(operation => ({ ...operation, authorized: true }))));
    return { runId: result.runId, commands: await verify(workspace) };
  });
  await check('Context7 returns actual source-linked documentation', async () => {
    const tools = new CodingToolsService(root, { ...config, enabled: true });
    const result = await tools.documentation('live-evaluation', 'How do I use node:test and strict assertions to test a function?', '/nodejs/node');
    assert.ok(result.content.includes('https://')); assert.ok(result.content.includes('assert'));
    return { runId: result.runId, sourcePreview: result.content.slice(0, 1500) };
  });
  await check('Aider and Ollama fix a real arithmetic bug', () => aiderCase('aider-bug', {
    'package.json': '{"scripts":{"test":"node --test check.cjs"}}', 'calc.cjs': 'module.exports = (a, b) => a - b;\n',
    'check.cjs': "const {test}=require('node:test');const assert=require('node:assert/strict');const add=require('./calc.cjs');test('add',()=>{assert.equal(add(2,3),5);assert.equal(add(-2,3),1);assert.equal(add(0,0),0);});",
  }, ['calc.cjs'], 'Fix calc.cjs so the exported function returns the sum of a and b, including negative numbers and zero. Preserve the CommonJS export.'));
  await check('Aider and Ollama implement a feature across existing and new files', () => aiderCase('aider-feature', {
    'package.json': '{"scripts":{"test":"node --test check.cjs"}}', 'greeter.cjs': "module.exports = name => 'Hello, ' + name;\n",
    'check.cjs': "const {test}=require('node:test');const assert=require('node:assert/strict');const greet=require('./greeter.cjs');const normalize=require('./format.cjs');test('greeting',()=>{assert.equal(greet('  Ada  '),'Hello, Ada!');assert.equal(greet(''),'Hello, friend!');assert.equal(normalize('  Ada  '),'Ada');});",
  }, ['greeter.cjs'], 'Create format.cjs exporting a CommonJS function that trims a string and returns "friend" for an empty or whitespace-only string. Update greeter.cjs to require it and return exactly "Hello, Ada!" for input "  Ada  " and "Hello, friend!" for empty input.', ['format.cjs']));
  await check('Aider and Ollama add executable tests', () => aiderCase('aider-tests', {
    'package.json': '{"scripts":{"test":"node --test clamp.test.cjs"}}', 'clamp.cjs': 'module.exports = (value, min, max) => Math.min(max, Math.max(min, value));\n',
  }, ['clamp.cjs'], 'Leave clamp.cjs unchanged. Create clamp.test.cjs using node:test and node:assert/strict. Test clamping below the minimum, above the maximum, within the range, and equal boundaries. Require ./clamp.cjs.', ['clamp.test.cjs']));
  await check('Ollama uses automatic TypeScript context and compiler/linter checks', () => aiderCase('aider-type-context', {
    'package.json': JSON.stringify({ scripts: { typecheck: `node "${path.join(root, 'node_modules/typescript/bin/tsc').replace(/\\/g, '/')}" --project tsconfig.json --noEmit`,
      test: `node "${path.join(root, 'node_modules/typescript/bin/tsc').replace(/\\/g, '/')}" --project tsconfig.json --outDir build --noEmit false && node --test check.cjs` } }),
    'tsconfig.json': '{"compilerOptions":{"strict":true,"target":"ES2022","module":"commonjs","types":[],"noEmit":true},"include":["*.ts"]}',
    'format.ts': "import { round } from './round';\nexport function formatAmount(value: number): string { return String(round(value)); }\n",
    'round.ts': 'export function round(value: number): number { return Math.round(value * 100) / 100; }\n',
    'use.ts': "import { formatAmount as label } from './format';\nexport function display(): string { return label(12); }\n",
    'check.cjs': "const {test}=require('node:test');const assert=require('node:assert/strict');const {formatAmount}=require('./build/format.js');test('currency',()=>{assert.equal(formatAmount(12),'$12.00');assert.equal(formatAmount(1.256),'$1.26');assert.equal(formatAmount(-2),'$-2.00');});",
  }, [], 'Fix format.ts so formatAmount returns a dollar sign followed by the imported rounding result formatted with exactly two decimal places. Preserve its number input and string return contract. For 12 return "$12.00"; for 1.256 return "$1.26". Use the imported helper and preserve callers.'));
  await check('Ollama writes fast-check properties that detect real implementation mutations', () => aiderCase('aider-properties', {
    'package.json': '{"scripts":{"test":"node --test reverse.property.test.cjs"},"devDependencies":{"fast-check":"4.10.2"}}',
    'reverse.cjs': 'module.exports = values => [...values].reverse();\n',
  }, [], 'Create reverse.property.test.cjs with node:test, node:assert/strict and fast-check (already installed in this fixture). Test the function from ./reverse.cjs using fc.array(fc.integer({min:-1000,max:1000}), {maxLength:50}), 100 runs and seed 20261031. For every array, save an original copy before calling reverse. Assert the result equals original.slice().reverse(), has the original length, and the input array still equals the original copy. Include a simple non-palindromic example. The implementation is read-only.', ['reverse.property.test.cjs'], { propertyTests: true }));
  await check('Fresh Ollama repair fixes remaining failures after an insufficient initial patch', async () => {
    const workspace = fixture('iterative-repair', { 'package.json': '{"scripts":{"test":"node --test check.cjs"}}',
      'calc.cjs': 'module.exports = (a, b) => a - b;\n', 'check.cjs': "const {test}=require('node:test');const assert=require('node:assert/strict');const add=require('./calc.cjs');test('add',()=>{assert.equal(add(2,3),5);assert.equal(add(0,2),2);});" });
    const agent = new CodingAgent({ workspaceRoot: workspace });
    const result = await agent.repair({ mode: 'debug', modelAdapter: new OllamaAdapter(config.ollamaUrl, config.model), maxIterations: 3,
      message: 'The exported function must add a and b. Both positive inputs and zero must work.',
      operations: [{ operation: 'modify', path: 'calc.cjs', expectedContent: 'module.exports = (a, b) => a - b;\n', content: 'module.exports = (a, b) => a * b;\n', reason: 'Deliberately incomplete initial proposal for repair-loop evaluation', authorized: true }] });
    assert.equal(result.status, 'passed', JSON.stringify(result)); assert.ok(result.attempts.length >= 2);
    return { attempts: result.attempts.map(attempt => ({ iteration: attempt.iteration, hypothesis: attempt.hypothesis, diagnostics: attempt.diagnosticDelta })), commands: await verify(workspace) };
  });
  console.log(JSON.stringify({ report: path.join(directory, 'verification.json'), passed: checks.filter(check => check.status === 'passed').length, failed: checks.filter(check => check.status !== 'passed').length }));
  if (!checks.length || checks.some(check => check.status !== 'passed')) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
