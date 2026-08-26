import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { OpenApiSchemaImporter } from '../OpenApiSchemaImporter';
import { MockApiEngine } from '../MockApiEngine';

describe('B75-08: Mock API Engine and OpenAPI Schema Importer Deep Matrix', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-matrix-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('OpenApiSchemaImporter Operations', () => {
    it('parses OpenAPI 3.0 specification into collections and routes', () => {
      const importer = new OpenApiSchemaImporter();

      const spec = {
        openapi: '3.0.0',
        info: { title: 'Store API', version: '2.0.0' },
        components: {
          schemas: {
            Product: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                price: { type: 'number' },
                inStock: { type: 'boolean' }
              },
              required: ['id', 'name']
            }
          }
        },
        paths: {
          '/products': {
            get: { summary: 'List products' },
            post: { summary: 'Create product' }
          },
          '/products/{id}': {
            get: { summary: 'Get product' },
            delete: { summary: 'Delete product' }
          }
        }
      };

      const result = importer.parseOpenApiSpec(spec);
      expect(result.title).toBe('Store API');
      expect(result.version).toBe('2.0.0');
      expect(result.collections.length).toBe(1);
      expect(result.collections[0].name).toBe('product');
      expect(result.generatedRoutes.length).toBe(4);
    });

    it('rejects remote refs and invalid payload structures for security', () => {
      const importer = new OpenApiSchemaImporter();

      const maliciousSpec = {
        openapi: '3.0.0',
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  $ref: 'https://malicious.example.com/schema.json'
                }
              }
            }
          }
        }
      };

      expect(() => importer.parseOpenApiSpec(maliciousSpec)).toThrow('Remote references');
      expect(() => importer.parseOpenApiSpec('{invalid JSON')).toThrow('Failed to parse OpenAPI');

      // Exceeds max payload size
      const hugeJson = JSON.stringify({ large: 'a'.repeat(500001) });
      expect(() => importer.parseOpenApiSpec(hugeJson)).toThrow('exceeds maximum allowed limit');
    });

    it('resolves local $refs, swagger 2.0 definitions, enum/email/uuid/date types, and auto id field', () => {
      const importer = new OpenApiSchemaImporter();

      const swagger2Spec = {
        swagger: '2.0',
        info: { title: 'User Microservice' },
        definitions: {
          Role: {
            type: 'string',
            enum: ['admin', 'editor', 'viewer']
          },
          UserProfile: {
            type: 'object',
            description: 'User details',
            properties: {
              email: { type: 'string', format: 'email' },
              uuid: { type: 'string', format: 'uuid' },
              created: { type: 'string', format: 'date-time' },
              role: { $ref: '#/definitions/Role' },
              tags: { type: 'array' },
              settings: { type: 'object' },
              count: { type: 'integer' }
            }
          }
        },
        paths: {
          '/users': {
            get: {},
            patch: { summary: 'Update user' }
          }
        }
      };

      const result = importer.parseOpenApiSpec(swagger2Spec);
      expect(result.title).toBe('User Microservice');
      expect(result.collections.length).toBe(2);

      const profile = result.collections.find(c => c.name === 'userprofile');
      expect(profile).toBeDefined();
      expect(profile?.fields.some(f => f.name === 'id')).toBe(true);
      expect(profile?.fields.find(f => f.name === 'email')?.type).toBe('email');
      expect(profile?.fields.find(f => f.name === 'uuid')?.type).toBe('uuid');
      expect(profile?.fields.find(f => f.name === 'created')?.type).toBe('date');
      expect(profile?.fields.find(f => f.name === 'role')?.type).toBe('enum');
      expect(profile?.fields.find(f => f.name === 'count')?.type).toBe('number');
      expect(profile?.fields.find(f => f.name === 'tags')?.type).toBe('array');
    });
  });

  describe('MockApiEngine CRUD Operations', () => {
    it('supports collection creation, record CRUD, query sorting, pagination, and persistence', () => {
      const engine = new MockApiEngine({
        workspaceRoot: tempDir,
        projectId: 'test-project'
      });

      engine.createCollection({
        name: 'customers',
        primaryKey: 'id',
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'email', type: 'string', required: true },
          { name: 'age', type: 'number', required: false }
        ]
      });

      expect(engine.getCollections().some(c => c.name === 'customers')).toBe(true);

      const r1 = engine.insertRecord('customers', { name: 'Alice', email: 'alice@example.com', age: 30 });
      const r2 = engine.insertRecord('customers', { name: 'Bob', email: 'bob@example.com', age: 25 });
      const r3 = engine.insertRecord('customers', { name: 'Charlie', email: 'charlie@example.com', age: 35 });

      expect(r1.id).toBeDefined();
      expect(engine.getRecordById('customers', r1.id)).toBeDefined();

      const updated = engine.updateRecord('customers', r1.id, { age: 31 });
      expect(updated.age).toBe(31);

      // Query with sorting and pagination
      const queryRes = engine.listRecords('customers', {
        sortBy: 'age',
        sortOrder: 'desc',
        page: 1,
        limit: 2
      });
      expect(queryRes.data.length).toBe(2);
      expect(queryRes.data[0].name).toBe('Charlie');
      expect(queryRes.total).toBe(3);

      engine.deleteRecord('customers', r2.id);
      expect(engine.getRecordById('customers', r2.id)).toBeNull();
    });
  });
});
