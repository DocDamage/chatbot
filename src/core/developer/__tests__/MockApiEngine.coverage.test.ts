import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MockApiEngine } from '../MockApiEngine';
import { CollectionSchema } from '../DeveloperTypes';

describe('MockApiEngine Deep Branch Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-api-engine-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('initializes from default, existing file, and corrupt file', () => {
    // 1. In-memory engine
    const memEngine = new MockApiEngine();
    expect(memEngine.getCollections().length).toBe(1);

    // 2. Persisted engine
    const persisted = new MockApiEngine({ workspaceRoot: tempDir, projectId: 'test-proj', initialSeed: 42 });
    expect(persisted.getCollections().length).toBe(1);

    // 3. Re-open existing valid file
    const reopened = new MockApiEngine({ workspaceRoot: tempDir, projectId: 'test-proj' });
    expect(reopened.getCollections().length).toBe(1);

    // 4. Re-open corrupted file (recovers to initial store)
    const filePath = path.join(tempDir, 'data', 'mock-api', 'corrupt-proj.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '{ corrupt json');
    const recovered = new MockApiEngine({ workspaceRoot: tempDir, projectId: 'corrupt-proj' });
    expect(recovered.getCollections().length).toBe(1);
  });

  it('creates collections, validates duplicate prevention, and seeds various field types', () => {
    const engine = new MockApiEngine();

    const productSchema: CollectionSchema = {
      name: 'products',
      primaryKey: 'id',
      seedCount: 3,
      fields: [
        { name: 'id', type: 'number', required: true },
        { name: 'title', type: 'string', required: true },
        { name: 'price', type: 'number', required: true },
        { name: 'active', type: 'boolean' },
        { name: 'contact', type: 'email' },
        { name: 'sku', type: 'uuid' },
        { name: 'releaseDate', type: 'date' },
        { name: 'status', type: 'enum', enumValues: ['draft', 'published', 'archived'] },
      ],
    };

    const created = engine.createCollection(productSchema);
    expect(created.name).toBe('products');
    expect(created.records.length).toBe(3);
    expect(typeof created.records[0].price).toBe('number');
    expect(typeof created.records[0].active).toBe('boolean');
    expect(created.records[0].contact).toContain('@example.com');
    expect(created.records[0].sku).toMatch(/^[0-9a-f-]{36}$/i);

    // Duplicate throws
    expect(() => engine.createCollection(productSchema)).toThrow("already exists");
  });

  it('imports data from CSV with formula sanitization and empty lines', () => {
    const engine = new MockApiEngine();

    const csvData = `
name,price,formula,formula2,formula3,formula4
Widget,100,=SUM(A1:A10),+1234,-5678,@HYPERLINK("http://evil.com")
Gadget,200,normal,normal2,normal3,normal4
`;

    const imported = engine.importFromText({
      name: 'widgets',
      format: 'csv',
      content: csvData,
    });

    expect(imported.records.length).toBe(2);
    expect(imported.records[0].formula).toBe("'=SUM(A1:A10)");
    expect(imported.records[0].formula2).toBe("'+1234");
    expect(imported.records[0].formula3).toBe("'-5678");
    expect(imported.records[0].formula4).toBe("'@HYPERLINK(\"http://evil.com\")");

    // Empty CSV
    const emptyImport = engine.importFromText({
      name: 'empty_test',
      format: 'csv',
      content: '   \n  \n',
    });
    expect(emptyImport.records.length).toBe(0);
  });

  it('imports JSON array and single object, inferring all schema field types', () => {
    const engine = new MockApiEngine();

    const sampleJson = JSON.stringify([
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        age: 30,
        isSubscribed: true,
        email: 'john@example.com',
        tags: ['tech', 'ai'],
        metadata: { score: 95 },
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Jane Doe',
        age: 28,
      },
    ]);

    const imported = engine.importFromText({
      name: 'customers',
      format: 'json',
      content: sampleJson,
    });

    expect(imported.records.length).toBe(2);
    const schema = imported.schema;
    expect(schema.fields.find(f => f.name === 'age')?.type).toBe('number');
    expect(schema.fields.find(f => f.name === 'isSubscribed')?.type).toBe('boolean');
    expect(schema.fields.find(f => f.name === 'email')?.type).toBe('email');
    expect(schema.fields.find(f => f.name === 'id')?.type).toBe('uuid');
    expect(schema.fields.find(f => f.name === 'tags')?.type).toBe('array');
    expect(schema.fields.find(f => f.name === 'metadata')?.type).toBe('object');

    // Single object JSON overwrite
    const singleObj = JSON.stringify({ name: 'Single Item', price: 50 });
    const importedSingle = engine.importFromText({
      name: 'customers',
      format: 'json',
      content: singleObj,
    });
    expect(importedSingle.records.length).toBe(1);
  });

  it('performs rich querying, filtering, sorting asc/desc, pagination, and relational expansions', () => {
    const engine = new MockApiEngine();

    // 1. Create authors & posts with relation
    engine.createCollection({
      name: 'authors',
      primaryKey: 'id',
      fields: [
        { name: 'id', type: 'number', required: true },
        { name: 'name', type: 'string', required: true },
      ],
    });
    engine.insertRecord('authors', { id: 1, name: 'Alice Author' });
    engine.insertRecord('authors', { id: 2, name: 'Bob Author' });

    engine.createCollection({
      name: 'posts',
      primaryKey: 'id',
      fields: [
        { name: 'id', type: 'number', required: true },
        { name: 'title', type: 'string', required: true },
        { name: 'authorId', type: 'number', referenceCollection: 'authors' },
        { name: 'views', type: 'number' },
      ],
    });
    engine.insertRecord('posts', { id: 101, title: 'Alpha Post', authorId: 1, views: 10 });
    engine.insertRecord('posts', { id: 102, title: 'Beta Post', authorId: 2, views: 20 });
    engine.insertRecord('posts', { id: 103, title: 'Gamma Post', authorId: 1, views: 30 });

    // 2. Query with filter, sort desc, and relations
    const queryRes = engine.listRecords('posts', {
      filter: { title: 'Post', views: '' }, // empty filter key skipped
      sortBy: 'views',
      sortOrder: 'desc',
      includeRelations: true,
      page: 1,
      limit: 2,
    });

    expect(queryRes.total).toBe(3);
    expect(queryRes.data.length).toBe(2);
    expect(queryRes.data[0].id).toBe(103);
    expect(queryRes.data[0].author.name).toBe('Alice Author');
    expect(queryRes.totalPages).toBe(2);

    // 3. Query sort asc
    const queryAsc = engine.listRecords('posts', { sortBy: 'views', sortOrder: 'asc', page: 2, limit: 2 });
    expect(queryAsc.data[0].id).toBe(103);

    // 4. Non-existent collection throws
    expect(() => engine.listRecords('non_existent')).toThrow('not found');
  });

  it('performs CRUD operations with schema validations and ID lookups', () => {
    const engine = new MockApiEngine();

    // 1. Get record by ID
    const user1 = engine.getRecordById('users', 1);
    expect(user1?.name).toBe('Ada Lovelace');
    expect(engine.getRecordById('users', 999)).toBeNull();
    expect(engine.getRecordById('missing_col', 1)).toBeNull();

    // 2. Validation failures on insert
    expect(() => engine.insertRecord('users', { id: 10, email: 'ada@example.com' })).toThrow("Field 'name' is required");
    expect(() => engine.insertRecord('users', { id: 10, name: 'Test', email: 'invalid-email' })).toThrow('valid email');
    expect(() => engine.insertRecord('users', { id: 10, name: 'Test', email: 't@e.com', role: 'superadmin' })).toThrow('not in allowed enum values');
    expect(() => engine.insertRecord('missing_col', {})).toThrow('not found');

    // 3. Insert record with auto-generated uuid pk on collection without required id
    engine.createCollection({
      name: 'notes',
      primaryKey: 'id',
      fields: [{ name: 'text', type: 'string' }]
    });
    const newNote = engine.insertRecord('notes', { text: 'Hello note' });
    expect(newNote.id).toBeDefined();

    // 4. Update record and partial validations
    expect(() => engine.updateRecord('users', 1, { email: 'bad-email' })).toThrow('valid email');
    expect(() => engine.updateRecord('users', 999, { name: 'Nobody' })).toThrow('not found');
    expect(() => engine.updateRecord('missing_col', 1, {})).toThrow('not found');

    const updated = engine.updateRecord('users', 1, { name: 'Ada King Lovelace' });
    expect(updated.name).toBe('Ada King Lovelace');
    expect(updated.id).toBe(1);

    // 5. Delete record
    expect(engine.deleteRecord('users', 1)).toBe(true);
    expect(engine.deleteRecord('users', 1)).toBe(false);
    expect(engine.deleteRecord('missing_col', 1)).toBe(false);

    // 6. Reset to seed
    engine.resetToSeed(999);
    expect(engine.getRecordById('users', 1)).toBeDefined();
  });
});
