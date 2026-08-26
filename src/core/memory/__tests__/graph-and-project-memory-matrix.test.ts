import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { GraphMemory } from '../GraphMemory';
import { ProjectMemoryStore } from '../../project-memory/capture/ProjectMemoryStore';
import { ProjectMemoryRecord } from '../../project-memory/capture/ProjectMemorySchema';

describe('B75-08: Graph Memory and Project Memory Store Deep Coverage Matrix', () => {
  let tempDir: string;
  let persistPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-mem-test-'));
    persistPath = path.join(tempDir, 'graph.json');
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('GraphMemory Operations', () => {
    it('manages entities, relationships, queries, decay, and persistence', async () => {
      const memory = new GraphMemory({ persistPath, decayRate: 0.1 });

      const e1 = memory.addEntity('person', 'Alice', { role: 'Engineer' });
      const e2 = memory.addEntity('project', 'ChatBot', { lang: 'TypeScript' });
      const e3 = memory.addEntity('concept', 'RAG', { domain: 'AI' });

      expect(memory.getEntity(e1.id)).toBeDefined();
      expect(memory.findEntityByName('Alice', 'person')).toBe(e1.id);

      const r1 = memory.addRelationship(e1.id, e2.id, 'works_on', { hours: 40 }, 1.0);
      const r2 = memory.addRelationship(e2.id, e3.id, 'uses', {}, 0.8);

      expect(r1.id).toBeDefined();
      expect(r2.id).toBeDefined();

      const searchRes = memory.searchEntities('ChatBot', {
        entityTypes: ['project']
      });
      expect(searchRes.length).toBe(1);

      const context = await memory.getContext('Alice', { minDecayScore: 0.1 });
      expect(context.entities.length).toBeGreaterThanOrEqual(1);

      memory.updateEntity(e1.id, { role: 'Lead Architect' });
      expect(memory.getEntity(e1.id)?.properties.role).toBe('Lead Architect');

      await memory.shutdown();
      expect(fs.existsSync(persistPath)).toBe(true);

      const loadedMemory = new GraphMemory({ persistPath });
      await loadedMemory.initialize();
      expect(loadedMemory.findEntityByName('Alice', 'person')).toBeDefined();
      await loadedMemory.shutdown();
    });
  });

  describe('ProjectMemoryStore Operations', () => {
    it('enforces multi-tenant access rules, query filtering, and durability', () => {
      const store = ProjectMemoryStore.getInstance();
      store.clear();

      const record1: ProjectMemoryRecord = {
        id: 'mem_1',
        ownerId: 'user_alice',
        authorId: 'user_alice',
        projectId: 'proj_alpha',
        repositoryId: 'repo_1',
        branch: 'main',
        originatingCommit: 'abcdef123456',
        accessScope: 'user_only',
        kind: 'decision',
        title: 'Use SQLite',
        content: 'Decided to use SQLite for expansion store',
        freshnessState: 'current',
        approvalState: 'approved',
        captureMethod: 'explicit_user',
        retentionClass: 'permanent',
        isProtected: false,
        evidence: [],
        relatedFiles: [],
        relatedSymbols: [],
        tags: ['architecture', 'database'],
        confidence: 0.95,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const record2: ProjectMemoryRecord = {
        id: 'mem_2',
        ownerId: 'user_bob',
        authorId: 'user_bob',
        projectId: 'proj_alpha',
        repositoryId: 'repo_1',
        branch: 'main',
        originatingCommit: '123456abcdef',
        accessScope: 'project_shared',
        kind: 'convention',
        title: 'Factory Pattern',
        content: 'Use factories for service initialization',
        freshnessState: 'current',
        approvalState: 'approved',
        captureMethod: 'explicit_user',
        retentionClass: 'permanent',
        isProtected: true,
        evidence: [],
        relatedFiles: [],
        relatedSymbols: [],
        tags: ['pattern'],
        confidence: 0.88,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      store.save(record1);
      store.save(record2);

      // Alice accesses her user_only memory
      expect(store.get('mem_1', { userId: 'user_alice', projectId: 'proj_alpha' })).toBeDefined();

      // Bob tries to access Alice's user_only memory -> blocked
      expect(store.get('mem_1', { userId: 'user_bob', projectId: 'proj_alpha' })).toBeUndefined();

      // Admin accesses user_only memory -> allowed
      expect(store.get('mem_1', { userId: 'user_bob', isAdmin: true })).toBeDefined();

      // Alice accesses Bob's project_shared memory in same project -> allowed
      expect(store.get('mem_2', { userId: 'user_alice', projectId: 'proj_alpha' })).toBeDefined();

      // Query with tags and text search
      const queryResults = store.query(
        { tags: ['database'], searchQuery: 'SQLite' },
        { userId: 'user_alice', projectId: 'proj_alpha' }
      );
      expect(queryResults.length).toBe(1);
      expect(queryResults[0].id).toBe('mem_1');

      // Delete item
      expect(() => store.delete('mem_1', { userId: 'user_bob' })).toThrow('Access denied');
      expect(store.delete('mem_1', { userId: 'user_alice' })).toBe(true);
      expect(store.get('mem_1', { userId: 'user_alice' })?.freshnessState).toBe('deleted');
    });
  });
});
