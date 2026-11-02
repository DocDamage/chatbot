import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GraphMemory } from '../GraphMemory';

describe('RT-MEM-001: GraphMemory Knowledge Graph and Temporal Decay Suite', () => {
  let tempDir: string;
  let memory: GraphMemory;
  let persistPath: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-memory-test-'));
    persistPath = path.join(tempDir, 'graph.json');
    memory = new GraphMemory({
      persistPath,
      autoSave: false,
      maxEntities: 10,
      decayRate: 0.1
    });
    await memory.initialize();
  });

  afterEach(async () => {
    await memory.shutdown();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('adds, updates, retrieves, and indexes entities', () => {
    const user = memory.addEntity('person', 'Alice', { role: 'admin' });
    expect(user.id).toBeDefined();
    expect(user.name).toBe('Alice');

    // Duplicate addition updates properties
    const updatedUser = memory.addEntity('person', 'Alice', { team: 'core' });
    expect(updatedUser.id).toBe(user.id);
    expect(updatedUser.properties.role).toBe('admin');
    expect(updatedUser.properties.team).toBe('core');

    const retrieved = memory.getEntity(user.id);
    expect(retrieved?.name).toBe('Alice');

    // Update non-existent entity throws
    expect(() => memory.updateEntity('non-existent', {})).toThrow('Entity not found');
  });

  it('manages relationships and graph traversals', () => {
    const alice = memory.addEntity('person', 'Alice');
    const project = memory.addEntity('project', 'ChatBot');

    const rel = memory.addRelationship(alice.id, project.id, 'maintains', { since: 2026 });
    expect(rel.sourceId).toBe(alice.id);
    expect(rel.targetId).toBe(project.id);

    const related = memory.getRelatedEntities(alice.id);
    expect(related).toHaveLength(1);
    expect(related[0].name).toBe('ChatBot');

    // Non-existent source or target throws
    expect(() => memory.addRelationship('bad-source', project.id, 'rel')).toThrow('Source entity not found');
    expect(() => memory.addRelationship(alice.id, 'bad-target', 'rel')).toThrow('Target entity not found');
  });

  it('queries entities with filters and generates formatted context summaries', async () => {
    const alice = memory.addEntity('person', 'Alice', { title: 'Lead' });
    const bob = memory.addEntity('person', 'Bob');
    const doc = memory.addEntity('file', 'README.md');

    memory.addRelationship(alice.id, doc.id, 'authored');
    memory.addRelationship(bob.id, doc.id, 'reviewed');

    const queried = memory.searchEntities('Alice', { entityTypes: ['person'], limit: 2 });
    expect(queried.length).toBeGreaterThan(0);

    const context = await memory.getContext('Alice');
    expect(context.entities.length).toBeGreaterThan(0);
    expect(context.summary).toContain('Alice');
  });

  it('applies temporal decay score and prunes old entities when exceeding capacity', () => {
    // Fill up past maxEntities (10)
    for (let i = 0; i < 12; i++) {
      memory.addEntity('concept', `Topic-${i}`);
    }

    memory.applyDecay();
    const all = memory.searchEntities('');
    expect(all.length).toBeLessThanOrEqual(10);
  });

  it('persists graph to file and reloads upon initialization', async () => {
    memory.addEntity('fact', 'TypeScript is statically typed');
    await memory.shutdown();

    expect(fs.existsSync(persistPath)).toBe(true);

    const reloaded = new GraphMemory({
      persistPath,
      autoSave: false
    });
    await reloaded.initialize();

    const facts = reloaded.searchEntities('TypeScript', { entityTypes: ['fact'] });
    expect(facts).toHaveLength(1);
    expect(facts[0].name).toBe('TypeScript is statically typed');
    await reloaded.shutdown();
  });

  it('extracts entities from natural language text and tracks statistics', async () => {
    const text = "I am Charlie. I prefer dark mode in my IDE. Working on project Phoenix with file index.ts.";
    const extracted = await memory.extractFromText(text, 'chat');
    expect(extracted.length).toBeGreaterThanOrEqual(3);

    const stats = memory.getStats();
    expect(stats.entityCount).toBeGreaterThanOrEqual(3);
    expect(stats.avgDecayScore).toBeGreaterThan(0);
    expect(stats.typeDistribution.person).toBeGreaterThanOrEqual(1);

    // Test remove entity
    const charlie = extracted.find(e => e.name === 'Charlie');
    if (charlie) {
      expect(memory.removeEntity(charlie.id)).toBe(true);
      expect(memory.getEntity(charlie.id)).toBeUndefined();
    }
    expect(memory.removeEntity('non-existent')).toBe(false);
  });
});
