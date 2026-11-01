import fs from 'fs';
import os from 'os';
import path from 'path';
import { selectAutomaticContext } from './AutomaticContext';
import { captureFiles, captureNewFiles } from './ToolWorkspace';

describe('automatic supporting context', () => {
  let root: string;
  const write = (file: string, text: string) => { const output = path.join(root, file); fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, text); };
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-context-'));
    write('src/value.ts', "import { suffix } from './suffix'; export function value(name: string) { return name + suffix; }\n");
    write('src/suffix.ts', "export const suffix = '!';\n");
    write('src/caller.ts', "import { value as label } from './value'; export const title = label('Ada');\n");
    write('src/value.test.ts', "import { value } from './value'; export const sample = value('');\n");
    write('.env.local', 'PRIVATE_CANARY=never-selected'); write('data/private.ts', 'export const PRIVATE_CANARY = true;');
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  it('follows imports, importing callers and related tests without expanding edit permissions', () => {
    const result = selectAutomaticContext(root, captureFiles(root, ['src/value.ts']), [], 'Fix the label');
    expect(result.editable.map(file => file.path)).toEqual(['src/value.ts']);
    expect(result.readOnly.map(file => file.path)).toEqual(expect.arrayContaining(['src/suffix.ts', 'src/caller.ts', 'src/value.test.ts']));
    expect(result.summary.every(item => !item.path.includes('private') && !item.path.startsWith('.env'))).toBe(true);
    expect(result.summary.filter(item => item.role === 'editable')).toHaveLength(1);
  });
  it('follows exact and wildcard TypeScript path aliases for dependencies and importing callers', () => {
    write('tsconfig.json', JSON.stringify({ compilerOptions: {
      baseUrl: '.', paths: { '@value': ['src/value'], '@src/*': ['src/*'] }
    } }));
    write('src/value.ts', "import { suffix } from '@src/suffix'; export function value(name: string) { return name + suffix; }\n");
    write('src/caller.ts', "import { value as label } from '@value'; export const title = label('Ada');\n");
    write('src/value.test.ts', "import { value } from '@value'; export const sample = value('');\n");

    const result = selectAutomaticContext(root, captureFiles(root, ['src/value.ts']), [], 'Fix the label');

    expect(result.readOnly.map(file => file.path)).toEqual(expect.arrayContaining(['src/suffix.ts', 'src/caller.ts', 'src/value.test.ts']));
  });
  it('uses the nearest nested config and preserves an inherited path mapping base origin', () => {
    write('configs/base.json', JSON.stringify({ compilerOptions: {
      baseUrl: './base', paths: { '@shared/*': ['shared/*'] }
    } }));
    write('apps/web/tsconfig.json', JSON.stringify({
      extends: '../../configs/base.json', compilerOptions: { baseUrl: './src' }
    }));
    write('configs/base/shared/value.ts', 'export const shared = true;\n');
    write('apps/web/src/page.ts', "import { shared } from '@shared/value'; export const page = shared;\n");
    write('apps/web/src/shared/value.ts', 'export const wrong = true;\n');

    const result = selectAutomaticContext(root, captureFiles(root, ['apps/web/src/page.ts']), [], 'Fix page');

    expect(result.readOnly.map(file => file.path)).toContain('configs/base/shared/value.ts');
    expect(result.readOnly.map(file => file.path)).not.toContain('apps/web/src/shared/value.ts');
  });
  it('falls back to relative imports and reports unsafe or invalid alias configuration', () => {
    write('tsconfig.json', '{');
    const invalid = selectAutomaticContext(root, captureFiles(root, ['src/value.ts']), [], 'Fix value');
    expect(invalid.readOnly.map(file => file.path)).toContain('src/suffix.ts');
    expect(invalid.limitations.some(note => note.includes('TypeScript alias configuration'))).toBe(true);

    write('tsconfig.json', JSON.stringify({ compilerOptions: {
      baseUrl: '.', paths: { '@private/*': ['data/private/*'], '@outside/*': ['../outside/*'] }
    } }));
    write('src/value.ts', "import { suffix } from './suffix'; import '@private/secret'; import '@outside/value'; export const value = suffix;\n");
    const blocked = selectAutomaticContext(root, captureFiles(root, ['src/value.ts']), [], 'Fix value');
    expect(blocked.readOnly.map(file => file.path)).toContain('src/suffix.ts');
    expect(blocked.summary.some(file => file.path.includes('private') || file.path.startsWith('../'))).toBe(false);
    expect(blocked.limitations.some(note => note.includes('path alias'))).toBe(true);
  });
  it('selects implementation files from named tasks and rejects ungrounded guesses', () => {
    expect(selectAutomaticContext(root, [], [], 'Fix src/value.ts so empty names work').editable.map(file => file.path)).toEqual(['src/value.ts']);
    expect(selectAutomaticContext(root, [], [], 'Fix the value function').editable.map(file => file.path)).toEqual(['src/value.ts']);
    expect(() => selectAutomaticContext(root, [], [], 'Make everything better')).toThrow(/Name an implementation file/);
    expect(() => selectAutomaticContext(root, [], [], 'Fix src/value.ts', false)).toThrow(/Select between/);
  });
  it('keeps explicitly named new test files editable and discovers their implementation as read-only context', () => {
    const result = selectAutomaticContext(root, [], captureNewFiles(root, ['src/value.property.test.ts']), 'Write property tests for src/value.ts');
    expect(result.editable.map(file => file.path)).toEqual(['src/value.property.test.ts']);
    expect(result.readOnly.some(file => file.path === 'src/value.ts')).toBe(true);
    expect(fs.existsSync(path.join(root, 'src/value.property.test.ts'))).toBe(false);
  });
  it('reports budget omissions and skips symlinks, oversized context and disabled auto selection', () => {
    write('src/value.big.test.ts', 'x'.repeat(18000));
    fs.symlinkSync(path.join(root, 'src'), path.join(root, 'linked'), 'junction');
    const result = selectAutomaticContext(root, captureFiles(root, ['src/value.ts']), [], 'Fix value.ts');
    expect(result.omitted).toBeGreaterThan(0);
    expect(result.summary.reduce((sum, file) => sum + file.bytes, 0)).toBeLessThanOrEqual(16000);
    expect(result.summary.every(file => !file.path.startsWith('linked/'))).toBe(true);
    const disabled = selectAutomaticContext(root, captureFiles(root, ['src/value.ts']), [], 'Fix value.ts', false);
    expect(disabled.readOnly).toEqual([]); expect(disabled.scannedFiles).toBe(0);
  });
});
