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
});
