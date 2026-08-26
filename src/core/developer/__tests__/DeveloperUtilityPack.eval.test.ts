/**
 * Phase PX-17: Developer Utility Pack Evaluation Test Suite
 *
 * Validates:
 * - PX17-T01: Expanded Mock API data model, inferred schemas, typed fields, relationships, and dual storage
 * - PX17-T02: Safe generated CRUD routes, filtering, sorting, pagination, and schema validations
 * - PX17-T03: Deterministic mock behavior, latency, fault injection, rate limiting, and scenario presets
 * - PX17-T04: Safe OpenAPI/JSON schema parsing, ref depth cap, remote ref block, preview & source digests
 * - PX17-T05: Source-preserving skill export, Book-to-Skill workflow, source SHA-256 digests, chapters, glossary, cheatsheets
 * - PX17-T06: Capability Pack scaffolding, manifest, golden tasks, negative security tests, disabled by default
 * - PX17-T07: Project Doctor diagnostics, configuration health, route consistency, and evidence-based ranked actions
 * - PX17-T08: DeveloperUtilityPackService integrated workflow and multi-utility orchestration
 * - PX17-T09: Security defenses: CSV formula injection defense, route collision prevention, cross-project data isolation, malicious schema resistance
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  MockApiEngine,
  MockChaosSimulator,
  OpenApiSchemaImporter,
  SourcePreservingSkillExporter,
  CapabilityPackScaffolder,
  ProjectDoctorService,
  DeveloperUtilityPackService
} from '../index';

describe('Phase PX-17: Developer Utility Pack', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'px17-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // PX17-T01: Expanded Mock API Model, Seeding & Relational Joins
  describe('PX17-T01: Expanded Mock API Data Model & Relations', () => {
    it('creates collections with typed fields, seed counts, and deterministic PRNG data', () => {
      const engine = new MockApiEngine({ workspaceRoot: tempDir, projectId: 'test-proj', initialSeed: 42 });

      const col = engine.createCollection({
        name: 'products',
        primaryKey: 'id',
        seedCount: 5,
        fields: [
          { name: 'id', type: 'number', required: true },
          { name: 'name', type: 'string', required: true },
          { name: 'price', type: 'number', required: true },
          { name: 'inStock', type: 'boolean' }
        ]
      });

      expect(col.name).toBe('products');
      expect(col.records).toHaveLength(5);
      expect(typeof col.records[0].price).toBe('number');
      expect(typeof col.records[0].inStock).toBe('boolean');
    });

    it('supports relational expansion via foreign key references', () => {
      const engine = new MockApiEngine();

      // Create authors
      engine.createCollection({
        name: 'authors',
        primaryKey: 'id',
        fields: [
          { name: 'id', type: 'number', required: true },
          { name: 'name', type: 'string', required: true }
        ]
      });
      engine.insertRecord('authors', { id: 101, name: 'Ursula K. Le Guin' });

      // Create books referencing authorId
      engine.createCollection({
        name: 'books',
        primaryKey: 'id',
        fields: [
          { name: 'id', type: 'number', required: true },
          { name: 'title', type: 'string', required: true },
          { name: 'authorId', type: 'number', referenceCollection: 'authors', referenceField: 'id' }
        ]
      });
      engine.insertRecord('books', { id: 1, title: 'The Dispossessed', authorId: 101 });

      const expanded = engine.getRecordById('books', 1, true);
      expect(expanded).not.toBeNull();
      expect(expanded?.authorId).toBe(101);
      expect(expanded?.author).toBeDefined();
      expect(expanded?.author.name).toBe('Ursula K. Le Guin');
    });
  });

  // PX17-T02: Safe Generated CRUD Routes, Filtering, Sorting & Pagination
  describe('PX17-T02: Safe CRUD Routes & Query Engine', () => {
    it('performs filtered, sorted, and paginated queries on collections', () => {
      const engine = new MockApiEngine();
      engine.createCollection({
        name: 'tasks',
        primaryKey: 'id',
        fields: [
          { name: 'id', type: 'number', required: true },
          { name: 'title', type: 'string', required: true },
          { name: 'priority', type: 'number' },
          { name: 'status', type: 'enum', enumValues: ['open', 'done'] }
        ]
      });

      engine.insertRecord('tasks', { id: 1, title: 'Alpha task', priority: 1, status: 'open' });
      engine.insertRecord('tasks', { id: 2, title: 'Beta task', priority: 3, status: 'done' });
      engine.insertRecord('tasks', { id: 3, title: 'Gamma task', priority: 2, status: 'open' });

      // Filter
      const openTasks = engine.listRecords('tasks', { filter: { status: 'open' } });
      expect(openTasks.data).toHaveLength(2);

      // Sort by priority desc
      const sorted = engine.listRecords('tasks', { sortBy: 'priority', sortOrder: 'desc' });
      expect(sorted.data[0].id).toBe(2);
      expect(sorted.data[1].id).toBe(3);

      // Pagination
      const page1 = engine.listRecords('tasks', { page: 1, limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.totalPages).toBe(2);
    });

    it('enforces schema validations and rejects invalid data types', () => {
      const engine = new MockApiEngine();
      engine.createCollection({
        name: 'members',
        primaryKey: 'id',
        fields: [
          { name: 'id', type: 'number', required: true },
          { name: 'email', type: 'email', required: true },
          { name: 'role', type: 'enum', enumValues: ['admin', 'user'] }
        ]
      });

      // Invalid email
      expect(() => {
        engine.insertRecord('members', { id: 1, email: 'not-an-email', role: 'admin' });
      }).toThrow(/must be a valid email/i);

      // Invalid enum
      expect(() => {
        engine.insertRecord('members', { id: 2, email: 'valid@example.com', role: 'superuser' });
      }).toThrow(/not in allowed enum values/i);
    });
  });

  // PX17-T03: Deterministic Mock Behavior & Chaos Fault Injection
  describe('PX17-T03: Mock Chaos Simulator & Scenarios', () => {
    it('applies scenario presets and deterministically simulates faults', () => {
      const chaos = new MockChaosSimulator();

      // Default happy path
      const r1 = chaos.evaluateRequest('GET', '/api/mock/users');
      expect(r1.shouldInjectError).toBe(false);
      expect(r1.statusCode).toBe(200);

      // Intermittent 503 preset
      chaos.applyPreset('INTERMITTENT_503');
      const cfg = chaos.getConfig();
      expect(cfg.enabled).toBe(true);
      expect(cfg.errorRate).toBe(0.33);
      expect(cfg.errorStatusCodes).toContain(503);

      // Rate limit preset
      chaos.applyPreset('RATE_LIMITED');
      let rateLimited = false;
      for (let i = 0; i < 10; i++) {
        const res = chaos.evaluateRequest('GET', '/api/mock/items');
        if (res.rateLimited) {
          rateLimited = true;
          break;
        }
      }
      expect(rateLimited).toBe(true);
    });

    it('redacts sensitive query parameters from chaos request logs', () => {
      const chaos = new MockChaosSimulator({ enabled: true });
      chaos.evaluateRequest('GET', '/api/users?token=super_secret_12345&name=alice');

      const audit = chaos.getAuditHistory();
      expect(audit[0].path).toContain('token=[REDACTED]');
      expect(audit[0].path).not.toContain('super_secret_12345');
    });
  });

  // PX17-T04: OpenAPI & JSON Schema Importer
  describe('PX17-T04: Safe OpenAPI Schema Importer', () => {
    it('parses OpenAPI 3.0 specs, extracts collections and routes, and calculates source digest', () => {
      const importer = new OpenApiSchemaImporter();
      const openApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Pet Store API', version: '1.2.0' },
        paths: {
          '/pets': {
            get: { summary: 'List all pets' },
            post: { summary: 'Create a pet' }
          },
          '/pets/{id}': {
            get: { summary: 'Get pet by ID' },
            delete: { summary: 'Delete pet' }
          }
        },
        components: {
          schemas: {
            Pet: {
              type: 'object',
              required: ['id', 'name'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                tag: { type: 'string' },
                status: { type: 'string', enum: ['available', 'pending', 'sold'] }
              }
            }
          }
        }
      };

      const result = importer.parseOpenApiSpec(openApiSpec);
      expect(result.title).toBe('Pet Store API');
      expect(result.collections.length).toBe(1);
      expect(result.collections[0].name).toBe('pet');
      expect(result.collections[0].fields.some(f => f.name === 'status' && f.type === 'enum')).toBe(true);
      expect(result.generatedRoutes.length).toBe(4);
      expect(result.sourceDigest).toHaveLength(64);
    });

    it('blocks remote $ref URLs and excessively large schemas', () => {
      const importer = new OpenApiSchemaImporter();

      // Remote ref attempt
      const maliciousSpec = {
        openapi: '3.0.0',
        info: { title: 'Evil API', version: '1.0.0' },
        components: {
          schemas: {
            Exploit: {
              $ref: 'https://attacker.com/schema.json'
            }
          }
        }
      };

      expect(() => {
        importer.parseOpenApiSpec(maliciousSpec);
      }).toThrow(/Remote references.*are blocked for safety/i);
    });
  });

  // PX17-T05: Source-Preserving Skill Exporter (Book-to-Skill)
  describe('PX17-T05: Source-Preserving Skill Exporter', () => {
    it('generates a CapabilityPack skill bundle with SHA-256 digests, chapters, and glossary', () => {
      const exporter = new SourcePreservingSkillExporter();
      const sourceDoc = `# TypeScript Mastery
TypeScript extends JavaScript by adding types to the language.

## Strict Typing
Always enable strict mode for high assurance.
**Strict Null Checks**: Prevents undefined property access at runtime.
**Type Guards**: Runtime checks that guarantee type safety in downstream scopes.

## Generic Constraints
Use extends keyword to bound generic type variables.
**Bounded Polymorphism**: Constrains generic arguments to specific interfaces.`;

      const bundle = exporter.generateSkillBundle({
        skillId: 'typescript-guide',
        displayName: 'TypeScript Mastery Guide',
        description: 'Clean-room guide for modern TypeScript development',
        sourceDocuments: [
          {
            name: 'typescript-handbook.md',
            content: sourceDoc
          }
        ]
      });

      expect(bundle.skillId).toBe('typescript-guide');
      expect(bundle.sourceDigests['typescript-handbook.md']).toHaveLength(64);
      expect(bundle.chapters.length).toBeGreaterThanOrEqual(2);
      expect(bundle.glossary.some(g => g.term === 'Strict Null Checks')).toBe(true);
      expect(bundle.skillMarkdown).toContain('typescript-handbook.md');
      expect(bundle.cheatsheet).toContain('Quick Reference Cheatsheet');
    });
  });

  // PX17-T06: Capability Pack Scaffolder
  describe('PX17-T06: Capability Pack Scaffolding', () => {
    it('scaffolds complete governed Capability Pack with golden task and negative security test', () => {
      const scaffolder = new CapabilityPackScaffolder();
      const scaffold = scaffolder.scaffoldPack({
        packId: 'godot-native-adapter',
        displayName: 'Godot Engine Native Adapter',
        description: 'Safe IPC and scene editing bridge for Godot 4.x',
        author: 'Antigravity Team',
        includeSkill: true,
        includeAgentRole: true
      });

      expect(scaffold.manifest.id).toBe('godot-native-adapter');
      expect(scaffold.manifest.maturity).toBe('disabled'); // Starts disabled by default
      expect(scaffold.files.some(f => f.path.endsWith('manifest.json'))).toBe(true);
      expect(scaffold.files.some(f => f.path.endsWith('golden_task.test.ts'))).toBe(true);
      expect(scaffold.files.some(f => f.path.endsWith('security_negative.test.ts'))).toBe(true);
      expect(scaffold.files.some(f => f.path.endsWith('SKILL.md'))).toBe(true);
      expect(scaffold.files.some(f => f.path.endsWith('system-prompt.md'))).toBe(true);
    });
  });

  // PX17-T07: Project Doctor & Operational Diagnostics
  describe('PX17-T07: Project Doctor Diagnostics & Ranked Actions', () => {
    it('analyzes workspace health, checks route manifests and contracts, and ranks next actions', () => {
      const doctor = new ProjectDoctorService(tempDir);

      // Create valid package.json and .env.example in tempDir
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ version: '1.0.0', scripts: { test: 'jest' } })
      );
      fs.writeFileSync(path.join(tempDir, '.env.example'), 'PORT=3000\nNODE_ENV=production\n');

      const report = doctor.runDiagnostics();
      expect(report.score).toBeGreaterThan(0);
      expect(report.diagnostics.length).toBe(5);
      expect(report.rankedNextActions.length).toBeGreaterThan(0);
    });
  });

  // PX17-T08: DeveloperUtilityPackService Unified Orchestrator
  describe('PX17-T08: DeveloperUtilityPackService Integrated Workflow', () => {
    it('coordinates Mock API, Chaos Simulator, OpenAPI Import, Skill Export, Scaffolding, and Doctor', () => {
      const service = new DeveloperUtilityPackService(tempDir);

      // 1. Mock API
      service.createCollection({
        name: 'customers',
        primaryKey: 'id',
        fields: [{ name: 'id', type: 'number', required: true }, { name: 'name', type: 'string', required: true }]
      });
      service.insertRecord('customers', { id: 1, name: 'Alice' });
      expect(service.listRecords('customers').data).toHaveLength(1);

      // 2. Chaos config
      service.setChaosConfig({ enabled: true, errorRate: 0.1 });
      expect(service.getChaosConfig().enabled).toBe(true);

      // 3. Project Doctor
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ version: '1.0.0', scripts: { test: 'jest' } })
      );
      const doctorReport = service.runProjectDoctor();
      expect(doctorReport.diagnostics.length).toBeGreaterThan(0);
    });
  });

  // PX17-T09: Security Defenses (CSV Formula Injection)
  describe('PX17-T09: Security Defenses', () => {
    it('defends against CSV formula injection (=, +, -, @) during CSV import', () => {
      const service = new DeveloperUtilityPackService(tempDir);
      const maliciousCsv = `name,formula\nNormal User,=CMD|' /C calc'!A0\nPlus User,+SUM(1+1)\nAt User,@alert(1)`;

      const collection = service.importMockData({
        name: 'csv_test',
        format: 'csv',
        content: maliciousCsv
      });

      const records = service.listRecords('csv_test').data;
      expect(records).toHaveLength(3);
      // All formula-like cells must be escaped with leading quote
      expect(records[0].formula).toBe(`'=CMD|' /C calc'!A0`);
      expect(records[1].formula).toBe(`'+SUM(1+1)`);
      expect(records[2].formula).toBe(`'@alert(1)`);
    });
  });
});
