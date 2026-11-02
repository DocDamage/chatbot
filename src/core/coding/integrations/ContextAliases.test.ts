import fs from 'fs';
import os from 'os';
import path from 'path';
import { ApprovedRepositoryGateway } from '../security/ApprovedRepositoryGateway';
import { createContextAliasResolver } from './ContextAliases';

describe('static context alias boundaries', () => {
  let root: string;
  const write = (file: string, content: string) => {
    const absolute = path.join(root, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
  };
  const json = (file: string, value: unknown) => write(file, JSON.stringify(value));
  const resolver = (files: string[]) => {
    const notes = new Set<string>();
    const resolve = createContextAliasResolver(root, new ApprovedRepositoryGateway(root), new Set(files), notes);
    return { resolve, notes };
  };
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'context-alias-')); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('resolves baseUrl imports and only the most specific alias with ordered target fallbacks', () => {
    json('tsconfig.json', { compilerOptions: { baseUrl: './src', paths: {
      '@/*': ['broad/*'], '@/specific/*': ['missing/*'], '@exact': ['missing', 'fallback'], '@core/*': ['missing/*', 'core/*']
    } } });
    const { resolve } = resolver(['src/main.ts', 'src/util/index.ts', 'src/broad/specific/value.ts', 'src/fallback.ts', 'src/core/value.ts']);
    expect(resolve('src/main.ts', 'util')).toBe('src/util/index.ts');
    expect(resolve('src/main.ts', '@/specific/value')).toBeUndefined();
    expect(resolve('src/main.ts', '@exact')).toBe('src/fallback.ts');
    expect(resolve('src/main.ts', '@core/value')).toBe('src/core/value.ts');
    expect(resolve('src/main.ts', 'uninstalled-package')).toBeUndefined();
    expect(resolve('src/main.ts', '../util')).toBeUndefined();
    expect(resolve('src/main.ts', 'unsafe\\name')).toBeUndefined();
  });

  it('merges relative multiple inheritance and anchors child paths to the child config', () => {
    json('config/paths.json', { compilerOptions: { paths: { '@old': ['./old'] } } });
    json('config/strict.json', { compilerOptions: { strict: true } });
    json('app/tsconfig.json', { extends: ['../config/paths.json', '../config/strict.json'] });
    let { resolve } = resolver(['app/main.ts', 'config/old.ts']);
    expect(resolve('app/main.ts', '@old')).toBe('config/old.ts');
    json('app/tsconfig.json', { extends: '../config/paths.json', compilerOptions: { paths: { '@new': ['./new'] } } });
    ({ resolve } = resolver(['app/main.ts', 'app/new.ts', 'config/old.ts']));
    expect(resolve('app/main.ts', '@new')).toBe('app/new.ts');
    expect(resolve('app/main.ts', '@old')).toBeUndefined();
  });

  it.each(['{', 'null', '[]', '{"compilerOptions":{"paths":"invalid"}}'])('isolates invalid nearest config %s', content => {
    json('tsconfig.json', { compilerOptions: { paths: { '@parent': ['./parent'] } } });
    write('app/tsconfig.json', content);
    const { resolve, notes } = resolver(['app/main.ts', 'parent.ts']);
    expect(resolve('app/main.ts', '@parent')).toBeUndefined();
    expect([...notes]).toContainEqual(expect.stringContaining('unavailable or invalid'));
  });

  it('rejects private and escaping aliases even when supplied in a known-path set', () => {
    json('tsconfig.json', { compilerOptions: { baseUrl: '.', paths: {
      '@private': ['data/value'], '@outside': ['../outside'], '@safe': ['src/value']
    } } });
    const { resolve, notes } = resolver(['src/main.ts', 'data/value.ts', '../outside.ts', 'src/value.ts']);
    expect(resolve('src/main.ts', '@private')).toBeUndefined();
    expect(resolve('src/main.ts', '@outside')).toBeUndefined();
    expect(resolve('src/main.ts', '@safe')).toBe('src/value.ts');
    expect([...notes]).toContainEqual(expect.stringContaining('repository policy'));
  });

  it('does not read package or linked config inheritance', () => {
    json('config/base.json', { compilerOptions: { paths: { '@hidden': ['./hidden'] } } });
    fs.symlinkSync(path.join(root, 'config'), path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    json('tsconfig.json', { extends: './linked/base.json' });
    let result = resolver(['src/main.ts', 'config/hidden.ts']);
    expect(result.resolve('src/main.ts', '@hidden')).toBeUndefined();
    expect(result.notes.size).toBeGreaterThan(0);
    json('tsconfig.json', { extends: 'untrusted-config' });
    result = resolver(['src/main.ts']);
    expect(result.resolve('src/main.ts', '@hidden')).toBeUndefined();
    expect(result.notes.size).toBeGreaterThan(0);
  });

  it('reports cyclic, oversized and excessive mapping configurations instead of expanding reads', () => {
    json('tsconfig.json', { extends: './tsconfig.json' });
    let result = resolver(['src/main.ts']);
    expect(result.resolve('src/main.ts', '@hidden')).toBeUndefined();
    expect(result.notes.size).toBeGreaterThan(0);
    write('tsconfig.json', ' '.repeat(32001));
    result = resolver(['src/main.ts']);
    expect(result.resolve('src/main.ts', '@hidden')).toBeUndefined();
    expect([...result.notes]).toContainEqual(expect.stringContaining('safety budget'));
    json('tsconfig.json', { compilerOptions: { paths: Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`@${i}`, ['./value']])) } });
    result = resolver(['src/main.ts', 'value.ts']);
    expect(result.resolve('src/main.ts', '@0')).toBeUndefined();
    expect([...result.notes]).toContainEqual(expect.stringContaining('safety budget'));
  });
});
