import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { CodingJobHistory } from './CodingJobHistory';

describe('coding job history', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-history-'));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });
  function save(owner: string, age: number) {
    const id = crypto.randomUUID(),
      directory = path.join(root, id);
    fs.mkdirSync(directory);
    const file = path.join(directory, 'result.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        id,
        owner,
        tool: 'aider',
        status: 'completed',
        startedAt: new Date().toISOString(),
        result: { patch: 'private patch' },
      })
    );
    fs.utimesSync(file, new Date(Date.now() - age), new Date(Date.now() - age));
    return id;
  }
  it('isolates owners and rejects path traversal and links', () => {
    const store = new CodingJobHistory(root);
    const id = save('alice', 0);
    expect(store.list('alice')).toHaveLength(1);
    expect(store.list('bob')).toEqual([]);
    expect(() => store.read('bob', id)).toThrow(/not found/);
    expect(() => store.read('alice', '../outside')).toThrow(/not found/);
    const link = crypto.randomUUID();
    fs.symlinkSync(
      path.join(root, id),
      path.join(root, link),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    expect(() => store.read('alice', link)).toThrow(/not found/);
  });
  it('expires only old inactive job directories and preserves active work', () => {
    const store = new CodingJobHistory(root, 1000);
    const old = save('alice', 5000),
      active = save('alice', 5000),
      recent = save('bob', 0);
    store.active.add(active);
    expect(store.cleanup()).toBe(1);
    expect(fs.existsSync(path.join(root, old))).toBe(false);
    expect(fs.existsSync(path.join(root, active))).toBe(true);
    expect(fs.existsSync(path.join(root, recent))).toBe(true);
  });
  it('skips malformed records without failing the whole history request', () => {
    const store = new CodingJobHistory(root);
    const id = save('alice', 0);
    const file = path.join(root, id, 'result.json');
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    delete record.startedAt;
    fs.writeFileSync(file, JSON.stringify(record));
    expect(store.list('alice')).toEqual([]);
  });

  it('requires an owner and handles an absent history directory', () => {
    const store = new CodingJobHistory(path.join(root, 'absent'));
    expect(store.list('alice')).toEqual([]);
    expect(store.cleanup()).toBe(0);
    expect(() => store.list('')).toThrow(/Authentication/);
    expect(() => store.read('', crypto.randomUUID())).toThrow(/Authentication/);
  });

  it.each([
    null,
    { id: 'wrong' },
    { tool: 42 },
    { startedAt: 'not a date' },
    { status: 'invented' },
    { completedAt: 42 },
    { completedAt: 'invalid' },
    { error: {} },
  ])('rejects malformed persisted record %#', (change) => {
    const store = new CodingJobHistory(root),
      id = save('alice', 0);
    const file = path.join(root, id, 'result.json');
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify(change === null ? null : { ...record, ...change }));
    expect(() => store.read('alice', id)).toThrow(/not found/);
  });

  it('returns newest records without private owner or result fields', () => {
    const store = new CodingJobHistory(root),
      first = save('alice', 0),
      second = save('alice', 0);
    for (const [id, startedAt] of [
      [first, '2026-01-01'],
      [second, '2026-02-01'],
    ]) {
      const file = path.join(root, id, 'result.json');
      const record = JSON.parse(fs.readFileSync(file, 'utf8'));
      fs.writeFileSync(
        file,
        JSON.stringify({ ...record, startedAt, completedAt: '2026-03-01', error: 'diagnostic' })
      );
    }
    expect(store.list('alice').map((record) => record.id)).toEqual([second, first]);
    expect(store.list('alice')[0]).not.toHaveProperty('result');
    expect(store.list('alice')[0]).not.toHaveProperty('owner');
  });

  it('cleans old orphan jobs but preserves unrelated directories', () => {
    const id = crypto.randomUUID(),
      orphan = path.join(root, id);
    fs.mkdirSync(orphan);
    fs.utimesSync(orphan, new Date(0), new Date(0));
    fs.mkdirSync(path.join(root, 'unrelated'));
    expect(new CodingJobHistory(root, 1000).cleanup()).toBe(1);
    expect(fs.existsSync(path.join(root, 'unrelated'))).toBe(true);
  });
});
