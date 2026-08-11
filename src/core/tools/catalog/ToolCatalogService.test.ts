import fs from 'fs';
import os from 'os';
import path from 'path';
import { Database } from '../../database/Database';
import { ToolCatalogService } from './ToolCatalogService';

describe('ToolCatalogService', () => {
  let root: string;
  let database: Database;

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-catalog-'));
    database = new Database({ type: 'sqlite', filePath: path.join(root, 'catalog.db') });
    await database.initialize();
  });

  afterEach(async () => {
    await database.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('seeds the catalog, filters tools, and reports category statistics', async () => {
    const service = new ToolCatalogService(database);
    const seeded = await service.seedInitialCatalog();
    expect(seeded.insertedOrUpdated).toBeGreaterThan(5);
    expect((await service.seedInitialCatalog()).insertedOrUpdated).toBe(seeded.insertedOrUpdated);

    const all = await service.listTools();
    expect(all.length).toBeGreaterThan(5);
    expect((await service.listTools({ category: 'creative', q: 'sprite', limit: 999 })).length).toBeGreaterThan(0);
    expect((await service.listTools({ category: 'missing', limit: 0 })).length).toBe(0);
    const stats = await service.getStats();
    expect(stats.total).toBe(seeded.insertedOrUpdated);
    expect(stats.byCategory.creative).toBeGreaterThan(0);
  });

  it('maps optional catalog fields and handles malformed JSON safely', () => {
    const service = new ToolCatalogService(database);
    const row = {
      id: 'id', name: 'Tool', slug: 'tool', category: 'test',
      subcategory: '', description: '', open_source_status: null, license: null,
      license_url: null, cost_model: null, official_url: null, source_url: null,
      cli_support: 1, api_support: 0, difficulty_level: null, integration_status: null,
      integration_module: null, trust_level: null, replaces_paid_tools_json: '{bad',
      comparable_tools_json: null, platforms_json: '["windows"]', install_methods_json: undefined,
      executable_names_json: [], best_for_json: '{}', not_good_for_json: '[]', metadata_json: '{}'
    };
    const mapped = (service as any).mapRow(row);
    expect(mapped).toMatchObject({ id: 'id', name: 'Tool', cliSupport: true, apiSupport: false });
    expect(mapped.replacesPaidTools).toEqual([]);
    expect(mapped.platforms).toEqual(['windows']);
    expect(mapped.comparableTools).toEqual([]);
  });
});
