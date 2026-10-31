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
