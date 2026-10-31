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

// Explicit live evaluation. Every editable repository is an isolated fixture under data/.
const root = process.cwd(), config = codingToolConfig(root);
const directory = fs.mkdtempSync(path.join(root, 'data/coding-tools/evaluation-'));
const checks: any[] = [];
const digest = (text: string) => crypto.createHash('sha256').update(text).digest('hex');
function fixture(name: string, files: Record<string, string>) {
  const workspace = path.join(directory, name); fs.mkdirSync(workspace, { recursive: true });
  for (const [file, content] of Object.entries(files)) { const output = path.join(workspace, file); fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, content); }
  return workspace;
}
async function check(name: string, work: () => Promise<unknown>) {
  const started = Date.now(); console.log(`Running ${name}`);
  try { const evidence = await work(); checks.push({ name, status: 'passed', durationMs: Date.now() - started, evidence }); console.log(`Passed ${name}`); }
  catch (error: any) { checks.push({ name, status: 'failed', durationMs: Date.now() - started, error: error.message }); console.error(`Failed ${name}: ${error.message}`); }
  fs.writeFileSync(path.join(directory, 'verification.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), model: config.model, workspace: directory, checks }, null, 2));
}
async function verify(workspace: string) {
  const result = await new VerificationOrchestrator(workspace).verify();
  assert.equal(result.status, 'passed', JSON.stringify(result));
  assert.ok(result.results.some(result => result.status === 'passed'));
  return result.results.map(result => ({ command: result.command, exitCode: result.exitCode }));
}
async function aiderCase(name: string, files: Record<string, string>, selected: string[], task: string, newFiles?: string[]) {
  const workspace = fixture(name, files), tools = new CodingToolsService(workspace, { ...config, enabled: true });
  const original = Object.fromEntries(Object.entries(files).map(([file, value]) => [file, digest(value)]));
  const documentation = name === 'aider-tests' ? { library: '/nodejs/node', query: 'CommonJS examples of node:test test(name, fn) and node:assert/strict. Explain TestContext methods and synchronous top-level tests without Tape APIs.' } : undefined;
  const result = await tools.propose('live-evaluation', { files: selected, newFiles, message: task, documentation });
  for (const [file, hash] of Object.entries(original)) assert.equal(digest(fs.readFileSync(path.join(workspace, file), 'utf8')), hash, 'Proposal must not edit the real fixture.');
  assert.ok(result.operations.length > 0); assert.ok(result.operations.every(operation => !operation.authorized));
  const operations = result.operations.map(operation => ({ ...operation, authorized: true }));
  const engine = new StructuredEditEngine(workspace); engine.apply(engine.createPatch(operations));
  const firstVerification = await new VerificationOrchestrator(workspace).verify();
  let repair: any;
  if (firstVerification.status === 'failed') {
    repair = await new CodingAgent({ workspaceRoot: workspace }).repair({ mode: 'debug', operations,
      alreadyApplied: true, modelAdapter: new OllamaAdapter(config.ollamaUrl, config.model), message: task, maxIterations: 3,
      referenceContext: result.documentation?.content, contextFiles: selected });
    assert.equal(repair.status, 'passed', JSON.stringify(repair));
  }
  const commands = await verify(workspace);
  // Tests are held outside the worker's edit scope.
  for (const [file, hash] of Object.entries(original).filter(([file]) => !selected.includes(file))) assert.equal(digest(fs.readFileSync(path.join(workspace, file), 'utf8')), hash);
  if (name === 'aider-tests') {
    const source = path.join(workspace, 'clamp.cjs'), originalSource = fs.readFileSync(source, 'utf8');
    try {
      fs.writeFileSync(source, 'module.exports = () => 0;\n');
      assert.equal((await new VerificationOrchestrator(workspace).verify()).status, 'failed', 'Generated tests must catch a deliberately broken implementation.');
    } finally { fs.writeFileSync(source, originalSource); }
  }
  return { runId: result.runId, model: result.model, changedFiles: result.operations.map(operation => operation.path),
    firstVerification: firstVerification.status, repairRounds: repair?.attempts.length || 0, draftChecks: result.draftChecks, mutationDetected: name === 'aider-tests' ? true : undefined, commands };
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
  if (checks.some(check => check.status !== 'passed')) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
