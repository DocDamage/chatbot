import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { GraphMemory } from '../GraphMemory';

describe('B75-08: GraphMemory Deep Coverage Matrix', () => {
  let tempDir: string;
  let persistFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-memory-matrix-'));
    persistFile = path.join(tempDir, 'graph_memory.json');
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('performs complete graph memory operations: add, relate, query, decay, prune, and persist', async () => {
    const memory = new GraphMemory({
      persistPath: persistFile,
      autoSave: false,
      decayRate: 0.05,
      maxEntities: 100
    });

    await memory.initialize();

    // Add entities
    const alice = memory.addEntity('person', 'Alice', { role: 'engineer' });
    const bob = memory.addEntity('person', 'Bob', { role: 'designer' });
    const projectX = memory.addEntity('project', 'ProjectX', { status: 'active' });

    expect(alice.id).toBeDefined();
    expect(bob.id).toBeDefined();

    // Query entity by name
    const foundAliceId = memory.findEntityByName('Alice', 'person');
    expect(foundAliceId).toBe(alice.id);

    // Add relationships
    const rel1 = memory.addRelationship(alice.id, projectX.id, 'works_on', { hoursPerWeek: 30 }, 1.0);
    const rel2 = memory.addRelationship(bob.id, projectX.id, 'designs_for', { lead: true }, 0.8);
    expect(rel1).toBeDefined();
    expect(rel2).toBeDefined();

    // Related entities
    const related = memory.getRelatedEntities(alice.id);
    expect(related.length).toBe(1);
    expect(related[0].id).toBe(projectX.id);

    // Search entities
    const searchRes = memory.searchEntities('Alice', { entityTypes: ['person'] });
    expect(searchRes.length).toBe(1);

    // Context summary
    const context = await memory.getContext('Alice');
    expect(context.entities.length).toBeGreaterThan(0);
    expect(context.summary).toBeDefined();

    // Update entity
    memory.updateEntity(alice.id, { role: 'lead_engineer' });
    expect(memory.getEntity(alice.id)?.properties.role).toBe('lead_engineer');

    // Duplicate relationship weight bump
    const relDuplicate = memory.addRelationship(alice.id, projectX.id, 'works_on', { note: 'updated' });
    expect(relDuplicate.weight).toBeGreaterThan(1.0);

    // Throws on missing entity
    expect(() => memory.updateEntity('nonexistent_id', {})).toThrow('not found');
    expect(() => memory.addRelationship('nonexistent_id', projectX.id, 'rel')).toThrow('not found');
    expect(() => memory.addRelationship(alice.id, 'nonexistent_id', 'rel')).toThrow('not found');

    // Prune on max entities exceed
    const smallMemory = new GraphMemory({
      persistPath: path.join(tempDir, 'small_mem.json'),
      maxEntities: 2,
      autoSave: false
    });
    await smallMemory.initialize();
    smallMemory.addEntity('concept', 'C1');
    smallMemory.addEntity('concept', 'C2');
    smallMemory.addEntity('concept', 'C3'); // triggers prune
    await smallMemory.shutdown();

    // Apply decay
    memory.applyDecay();

    // Remove entity
    const removed = memory.removeEntity(bob.id);
    expect(removed).toBe(true);

    // Save and shutdown
    await memory.shutdown();
    expect(fs.existsSync(persistFile)).toBe(true);

    // Re-initialize from saved file
    const memory3 = new GraphMemory({
      persistPath: persistFile,
      autoSave: false
    });
    await memory3.initialize();
    expect(memory3.getEntity(alice.id)).toBeDefined();
    await memory3.shutdown();
  });
});
