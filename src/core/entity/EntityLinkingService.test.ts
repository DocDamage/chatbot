import { EntityLinkingService } from './EntityLinkingService';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Database } from '../database/Database';

describe('EntityLinkingService', () => {
  it('normalizes software aliases, dates, and concepts', () => {
    const service = new EntityLinkingService();
    const result = service.link('In 1997, use Fruity Loops with a knowledge graph for music memory.');

    expect(result.facets.years).toContain(1997);
    expect(result.facets.software).toContain('fl_studio');
    expect(result.facets.concepts).toContain('knowledge_graph');
  });

  it('handles BCE dates as negative years', () => {
    const service = new EntityLinkingService();
    const result = service.link('What happened around 10000 BC?');

    expect(result.facets.years).toContain(-10000);
  });

  it('persists and searches linked entities when a database is configured', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-entities-'));
    const database = new Database({ type: 'sqlite', filePath: path.join(tempDir, 'test.db') });
    await database.initialize();

    const service = new EntityLinkingService(database);
    await service.linkAndPersist('Use FL Studio and a knowledge graph.');
    const results = await service.searchEntities('FL Studio');
    const stats = await service.stats();

    expect(results.some(entity => entity.normalized === 'fl_studio')).toBe(true);
    expect(stats.total).toBeGreaterThan(0);

    await database.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns linked entities and empty statistics without a database', async () => {
    const service = new EntityLinkingService();
    const result = await service.linkAndPersist('$AAPL and MSFT stock were discussed by Ada Lovelace in 42 AD, not 12.');

    expect(result.entities.some(entity => entity.type === 'ticker' && entity.normalized === 'AAPL')).toBe(true);
    expect(result.entities.some(entity => entity.type === 'ticker' && entity.normalized === 'MSFT')).toBe(true);
    expect(result.entities.some(entity => entity.type === 'person' && entity.label === 'Ada Lovelace')).toBe(true);
    expect(result.facets.years).toContain(42);
    expect(result.facets.years).not.toContain(12);
    await expect(service.searchEntities('New York')).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'place', normalized: 'new_york' })]),
    );
    await expect(service.stats()).resolves.toEqual({ total: 0, byType: {} });
  });

  it('uses PostgreSQL persistence/search and normalizes optional database fields', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'one',
            label: 'One',
            normalized: 'one',
            entity_type: 'concept',
            aliases: '',
            confidence: null,
            source: null,
          },
          {
            id: 'two',
            label: 'Two',
            normalized: 'two',
            entity_type: 'software',
            aliases: ['second'],
            confidence: 0.8,
            source: 'alias',
          },
        ],
        rowCount: 2,
      })
      .mockResolvedValueOnce({
        rows: [
          { entity_type: 'concept', count: null },
          { entity_type: 'software', count: '2' },
        ],
        rowCount: 2,
      });
    const database = { getType: () => 'postgresql', query } as any;
    const service = new EntityLinkingService(database);

    await service.linkAndPersist('Use OpenAI.');
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT (id) DO UPDATE');
    const found = await service.searchEntities('100%_safe', 2);
    expect(query.mock.calls[1][1]).toEqual(['%100safe%', 2]);
    expect(found).toEqual([
      expect.objectContaining({ aliases: [], confidence: 0, source: 'regex', endIndex: 3 }),
      expect.objectContaining({ aliases: ['second'], confidence: 0.8, source: 'alias' }),
    ]);
    await expect(service.stats()).resolves.toEqual({ total: 2, byType: { concept: 0, software: 2 } });
  });
});
