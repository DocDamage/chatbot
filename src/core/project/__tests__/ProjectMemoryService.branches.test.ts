import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProjectMemoryService } from '../ProjectMemoryService';

describe('ProjectMemoryService branch matrix', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-memory-service-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('validates content, applies defaults, trims and limits tags, and builds a resume file', () => {
    const service = new ProjectMemoryService(tempDir);
    expect(() => service.remember({ content: '   ' })).toThrow('content is required');

    const defaultEntry = service.remember({
      content: '  Remember this decision.  ',
      tags: [' first ', '', ...Array.from({ length: 25 }, (_, index) => `tag-${index}`)],
    });
    const decision = service.remember({ content: 'Use SQLite.', category: 'decision', tags: ['database'] });

    expect(defaultEntry).toMatchObject({ content: 'Remember this decision.', category: 'note' });
    expect(defaultEntry.tags).toHaveLength(20);
    expect(decision.category).toBe('decision');

    const resume = service.resume();
    expect(resume).toEqual({ path: '.remembrandt/MEMORY.md', entries: 2 });
    const markdown = fs.readFileSync(path.join(tempDir, '.remembrandt', 'MEMORY.md'), 'utf8');
    expect(markdown).toContain('## Decision');
    expect(markdown).toContain('_#database_');
  });

  it('filters query/category, clamps limits, sorts entries, and reports category status', () => {
    const service = new ProjectMemoryService(tempDir);
    service.remember({ content: 'Alpha note', category: 'note', tags: ['first'] });
    service.remember({ content: 'Beta decision', category: 'decision', tags: ['second'] });

    expect(service.list('beta')).toHaveLength(1);
    expect(service.list(undefined, 'note')).toHaveLength(1);
    expect(service.list('SECOND', 'decision')).toHaveLength(1);
    expect(service.list(undefined, undefined, 0)).toHaveLength(1);
    expect(service.list(undefined, undefined, 999)).toHaveLength(2);
    expect(service.status()).toMatchObject({
      entries: 2,
      categories: { note: 1, decision: 1 },
      memoryPath: '.remembrandt/MEMORY.md',
    });
  });

  it('skips invalid JSON and incomplete entry files', () => {
    const service = new ProjectMemoryService(tempDir);
    const entriesDir = path.join(tempDir, '.remembrandt', 'entries');
    fs.writeFileSync(path.join(entriesDir, 'invalid.json'), '{bad', 'utf8');
    fs.writeFileSync(path.join(entriesDir, 'incomplete.json'), JSON.stringify({ id: 'missing-content' }), 'utf8');
    fs.writeFileSync(path.join(entriesDir, 'ignored.txt'), 'not json', 'utf8');

    expect(service.list()).toEqual([]);
    expect(service.status()).toEqual({
      entries: 0,
      categories: {},
      memoryPath: '.remembrandt/MEMORY.md',
    });
  });
});
