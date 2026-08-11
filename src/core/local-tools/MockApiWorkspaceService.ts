import fs from 'node:fs';
import path from 'node:path';

export interface MockApiCollection {
  name: string;
  records: Array<Record<string, unknown>>;
  updatedAt: string;
}

interface MockApiStore {
  collections: MockApiCollection[];
}

export class MockApiWorkspaceService {
  private readonly filePath: string;

  constructor(workspaceRoot = process.cwd()) {
    const root = path.join(workspaceRoot, 'data', 'mock-api');
    fs.mkdirSync(root, { recursive: true });
    this.filePath = path.join(root, 'collections.json');
  }

  status(): { collections: Array<{ name: string; records: number; updatedAt: string }> } {
    return { collections: this.read().collections.map(collection => ({ name: collection.name, records: collection.records.length, updatedAt: collection.updatedAt })) };
  }

  list(name?: string): MockApiCollection[] {
    const collections = this.read().collections;
    return name ? collections.filter(collection => collection.name === name) : collections;
  }

  importText(input: { collection?: string; format?: 'json' | 'csv'; content: string }): MockApiCollection {
    const content = input.content.trim();
    if (!content) throw new Error('mock data content is required');
    const name = this.normalizeName(input.collection || 'records');
    const format = input.format || (content.startsWith('[') || content.startsWith('{') ? 'json' : 'csv');
    const records = format === 'json' ? this.parseJson(content) : this.parseCsv(content);
    if (records.length === 0) throw new Error('mock data did not contain any records');
    const collection: MockApiCollection = { name, records: records.map((record, index) => ({ id: record.id ?? index + 1, ...record })), updatedAt: new Date().toISOString() };
    const store = this.read();
    store.collections = [...store.collections.filter(item => item.name !== name), collection];
    this.write(store);
    return collection;
  }

  private parseJson(content: string): Array<Record<string, unknown>> {
    const parsed: unknown = JSON.parse(content);
    const values = Array.isArray(parsed) ? parsed : [parsed];
    if (!values.every(value => value && typeof value === 'object' && !Array.isArray(value))) throw new Error('JSON mock data must be an object or an array of objects');
    return values as Array<Record<string, unknown>>;
  }

  private parseCsv(content: string): Array<Record<string, unknown>> {
    const rows = content.split(/\r?\n/).filter(Boolean).map(row => row.split(',').map(value => value.trim().replace(/^"|"$/g, '')));
    if (rows.length < 2) throw new Error('CSV mock data needs a header row and at least one record');
    const headers = rows[0].map((header, index) => header || `column_${index + 1}`);
    return rows.slice(1).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
  }

  private normalizeName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'records';
  }

  private read(): MockApiStore {
    if (!fs.existsSync(this.filePath)) return { collections: [] };
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as MockApiStore;
      return { collections: Array.isArray(parsed.collections) ? parsed.collections : [] };
    } catch {
      return { collections: [] };
    }
  }

  private write(store: MockApiStore): void {
    fs.writeFileSync(this.filePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  }
}
