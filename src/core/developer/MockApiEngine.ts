/**
 * Phase PX-17: Mock API Data Engine & CRUD Processor
 * PX17-T01 & PX17-T02
 */

import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import {
  CollectionSchema,
  FieldDefinition,
  FieldType,
  MockApiCollectionData,
  MockApiCollectionRecord,
  MockApiStore
} from './DeveloperTypes';

export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: Record<string, any>;
  includeRelations?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class MockApiEngine {
  private store: MockApiStore;
  private filePath?: string;

  constructor(options?: { workspaceRoot?: string; projectId?: string; initialSeed?: number }) {
    const projectId = options?.projectId || 'default-project';
    const seed = options?.initialSeed ?? 12345;

    if (options?.workspaceRoot) {
      const dir = path.join(options.workspaceRoot, 'data', 'mock-api');
      fs.mkdirSync(dir, { recursive: true });
      this.filePath = path.join(dir, `${projectId}.json`);
    }

    if (this.filePath && fs.existsSync(this.filePath)) {
      try {
        this.store = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      } catch {
        this.store = this.createInitialStore(projectId, seed);
      }
    } else {
      this.store = this.createInitialStore(projectId, seed);
    }
  }

  public getCollections(): CollectionSchema[] {
    return this.store.collections.map(c => c.schema);
  }

  public getCollection(name: string): MockApiCollectionData | undefined {
    return this.store.collections.find(c => c.name.toLowerCase() === name.toLowerCase());
  }

  public createCollection(schema: CollectionSchema): MockApiCollectionData {
    const existing = this.getCollection(schema.name);
    if (existing) {
      throw new Error(`Collection '${schema.name}' already exists.`);
    }

    const colData: MockApiCollectionData = {
      name: schema.name.toLowerCase(),
      schema: {
        ...schema,
        primaryKey: schema.primaryKey || 'id'
      },
      records: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (schema.seedCount && schema.seedCount > 0) {
      colData.records = this.generateSeededRecords(colData.schema, schema.seedCount);
    }

    this.store.collections.push(colData);
    this.persist();
    return JSON.parse(JSON.stringify(colData));
  }

  public importFromText(input: {
    name: string;
    format: 'json' | 'csv';
    content: string;
  }): MockApiCollectionData {
    let records: Record<string, any>[] = [];

    if (input.format === 'csv') {
      records = this.parseCsv(input.content);
    } else {
      const parsed = JSON.parse(input.content);
      records = Array.isArray(parsed) ? parsed : [parsed];
    }

    // Infer schema from records
    const schema = this.inferSchema(input.name, records);
    const existingIdx = this.store.collections.findIndex(c => c.name === schema.name.toLowerCase());

    const colData: MockApiCollectionData = {
      name: schema.name.toLowerCase(),
      schema,
      records: records.map((r, i) => ({
        id: r.id ?? i + 1,
        ...r
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (existingIdx !== -1) {
      this.store.collections[existingIdx] = colData;
    } else {
      this.store.collections.push(colData);
    }

    this.persist();
    return JSON.parse(JSON.stringify(colData));
  }

  public listRecords(collectionName: string, query: QueryOptions = {}): PaginatedResult<MockApiCollectionRecord> {
    const col = this.getCollection(collectionName);
    if (!col) throw new Error(`Collection '${collectionName}' not found`);

    let items = [...col.records];

    // Filtering
    if (query.filter) {
      for (const [key, val] of Object.entries(query.filter)) {
        items = items.filter(record => {
          if (val === undefined || val === null || val === '') return true;
          return String(record[key]).toLowerCase().includes(String(val).toLowerCase());
        });
      }
    }

    // Sorting
    if (query.sortBy) {
      const order = query.sortOrder === 'desc' ? -1 : 1;
      const key = query.sortBy;
      items.sort((a, b) => {
        if (a[key] < b[key]) return -1 * order;
        if (a[key] > b[key]) return 1 * order;
        return 0;
      });
    }

    // Relational expansion
    if (query.includeRelations) {
      items = items.map(record => this.expandRelations(col.schema, record));
    }

    const total = items.length;
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const totalPages = Math.ceil(total / limit) || 1;
    const paginated = items.slice((page - 1) * limit, page * limit);

    return {
      data: paginated,
      total,
      page,
      limit,
      totalPages
    };
  }

  public getRecordById(collectionName: string, id: any, includeRelations = false): MockApiCollectionRecord | null {
    const col = this.getCollection(collectionName);
    if (!col) return null;

    const pk = col.schema.primaryKey || 'id';
    const found = col.records.find(r => String(r[pk]) === String(id));
    if (!found) return null;

    return includeRelations ? this.expandRelations(col.schema, found) : JSON.parse(JSON.stringify(found));
  }

  public insertRecord(collectionName: string, data: Record<string, any>): MockApiCollectionRecord {
    const col = this.getCollection(collectionName);
    if (!col) throw new Error(`Collection '${collectionName}' not found`);

    this.validateRecordAgainstSchema(col.schema, data, false);

    const pk = col.schema.primaryKey || 'id';
    const newRecord = {
      [pk]: data[pk] ?? uuidv4(),
      ...data,
      createdAt: new Date().toISOString()
    };

    col.records.push(newRecord);
    col.updatedAt = new Date().toISOString();
    this.persist();
    return JSON.parse(JSON.stringify(newRecord));
  }

  public updateRecord(collectionName: string, id: any, patch: Record<string, any>): MockApiCollectionRecord {
    const col = this.getCollection(collectionName);
    if (!col) throw new Error(`Collection '${collectionName}' not found`);

    const pk = col.schema.primaryKey || 'id';
    const idx = col.records.findIndex(r => String(r[pk]) === String(id));
    if (idx === -1) throw new Error(`Record with ${pk}=${id} not found`);

    this.validateRecordAgainstSchema(col.schema, patch, true);

    col.records[idx] = {
      ...col.records[idx],
      ...patch,
      [pk]: col.records[idx][pk], // protect primary key from accidental change
      updatedAt: new Date().toISOString()
    };

    col.updatedAt = new Date().toISOString();
    this.persist();
    return JSON.parse(JSON.stringify(col.records[idx]));
  }

  public deleteRecord(collectionName: string, id: any): boolean {
    const col = this.getCollection(collectionName);
    if (!col) return false;

    const pk = col.schema.primaryKey || 'id';
    const initialLen = col.records.length;
    col.records = col.records.filter(r => String(r[pk]) !== String(id));

    if (col.records.length !== initialLen) {
      col.updatedAt = new Date().toISOString();
      this.persist();
      return true;
    }
    return false;
  }

  public resetToSeed(seed?: number): void {
    const effectiveSeed = seed ?? this.store.seed;
    this.store.seed = effectiveSeed;
    for (const col of this.store.collections) {
      if (col.schema.seedCount && col.schema.seedCount > 0) {
        col.records = this.generateSeededRecords(col.schema, col.schema.seedCount);
      } else {
        col.records = [];
      }
      col.updatedAt = new Date().toISOString();
    }
    this.persist();
  }

  private expandRelations(schema: CollectionSchema, record: MockApiCollectionRecord): MockApiCollectionRecord {
    const cloned = { ...record };
    for (const field of schema.fields) {
      if (field.referenceCollection && cloned[field.name]) {
        const refCol = this.getCollection(field.referenceCollection);
        if (refCol) {
          const refPk = field.referenceField || refCol.schema.primaryKey || 'id';
          const refRecord = refCol.records.find(r => String(r[refPk]) === String(cloned[field.name]));
          if (refRecord) {
            const expandKey = field.name.replace(/Id$/i, '');
            cloned[expandKey] = refRecord;
          }
        }
      }
    }
    return cloned;
  }

  private validateRecordAgainstSchema(schema: CollectionSchema, record: Record<string, any>, isPartial: boolean): void {
    for (const field of schema.fields) {
      const val = record[field.name];
      if (field.required && !isPartial && (val === undefined || val === null || val === '')) {
        throw new Error(`Field '${field.name}' is required.`);
      }

      if (val !== undefined && val !== null) {
        if (field.type === 'number' && isNaN(Number(val))) {
          throw new Error(`Field '${field.name}' must be a valid number.`);
        }
        if (field.type === 'boolean' && typeof val !== 'boolean' && val !== 'true' && val !== 'false') {
          throw new Error(`Field '${field.name}' must be a boolean.`);
        }
        if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val))) {
          throw new Error(`Field '${field.name}' must be a valid email address.`);
        }
        if (field.enumValues && !field.enumValues.includes(String(val))) {
          throw new Error(`Field '${field.name}' value '${val}' is not in allowed enum values [${field.enumValues.join(', ')}].`);
        }
      }
    }
  }

  public inferSchema(name: string, records: Record<string, any>[]): CollectionSchema {
    const fields: FieldDefinition[] = [];
    const keys = new Set<string>();

    for (const r of records) {
      for (const k of Object.keys(r)) keys.add(k);
    }

    for (const key of keys) {
      const sampleVals = records.map(r => r[key]).filter(v => v !== undefined && v !== null);
      let type: FieldType = 'string';

      if (sampleVals.length > 0) {
        const first = sampleVals[0];
        if (typeof first === 'number') type = 'number';
        else if (typeof first === 'boolean') type = 'boolean';
        else if (typeof first === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(first)) type = 'email';
        else if (typeof first === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(first)) type = 'uuid';
        else if (Array.isArray(first)) type = 'array';
        else if (typeof first === 'object') type = 'object';
      }

      fields.push({
        name: key,
        type,
        required: key === 'id' || key === 'name'
      });
    }

    return {
      name,
      primaryKey: keys.has('id') ? 'id' : Array.from(keys)[0] || 'id',
      fields
    };
  }

  private generateSeededRecords(schema: CollectionSchema, count: number): MockApiCollectionRecord[] {
    const records: MockApiCollectionRecord[] = [];
    const prng = this.createPrng(this.store.seed);

    for (let i = 1; i <= count; i++) {
      const rec: Record<string, any> = { id: i };
      for (const field of schema.fields) {
        if (field.name === 'id') continue;
        rec[field.name] = this.generateFieldValue(field, i, prng);
      }
      records.push(rec);
    }
    return records;
  }

  private generateFieldValue(field: FieldDefinition, index: number, prng: () => number): any {
    if (field.enumValues && field.enumValues.length > 0) {
      const idx = Math.floor(prng() * field.enumValues.length);
      return field.enumValues[idx];
    }
    switch (field.type) {
      case 'number':
        return Math.floor(prng() * 1000) + 10;
      case 'boolean':
        return prng() > 0.5;
      case 'email':
        return `user${index}@example.com`;
      case 'uuid':
        return uuidv4();
      case 'date':
        return new Date(Date.now() - Math.floor(prng() * 100000000)).toISOString();
      default:
        return `${field.name}-${index}`;
    }
  }

  private createPrng(seed: number): () => number {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  private parseCsv(csv: string): Record<string, any>[] {
    const lines = csv.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];

    // Check for formula injection in CSV headers/cells
    const headers = lines[0].split(',').map(h => sanitizeCsvCell(h.trim()));
    const records: Record<string, any>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => sanitizeCsvCell(v.trim()));
      const row: Record<string, any> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? '';
      });
      records.push(row);
    }
    return records;
  }

  private createInitialStore(projectId: string, seed: number): MockApiStore {
    return {
      projectId,
      seed,
      updatedAt: new Date().toISOString(),
      collections: [
        {
          name: 'users',
          schema: {
            name: 'users',
            primaryKey: 'id',
            seedCount: 3,
            fields: [
              { name: 'id', type: 'number', required: true },
              { name: 'name', type: 'string', required: true },
              { name: 'email', type: 'email', required: true },
              { name: 'role', type: 'enum', enumValues: ['admin', 'developer', 'viewer'] }
            ]
          },
          records: [
            { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', role: 'admin' },
            { id: 2, name: 'Alan Turing', email: 'alan@example.com', role: 'developer' },
            { id: 3, name: 'Grace Hopper', email: 'grace@example.com', role: 'developer' }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    };
  }

  private persist(): void {
    if (this.filePath) {
      this.store.updatedAt = new Date().toISOString();
      fs.writeFileSync(this.filePath, JSON.stringify(this.store, null, 2), 'utf8');
    }
  }
}

function sanitizeCsvCell(val: string): string {
  // Prevent CSV formula injection (=, +, -, @)
  if (/^[=+\-@\t\r]/.test(val)) {
    return `'${val}`;
  }
  return val;
}
