import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { StructuredEditEngine } from '../editing/StructuredEditEngine';
import { CodingModelRouter, CodingModelCapability } from '../model/CodingModelRouter';

describe('B75-08: Structured Edit Engine and Coding Model Router Matrix', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-matrix-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('StructuredEditEngine Operations', () => {
    it('creates, parses natural language instructions, and applies multi-file patches', () => {
      const engine = new StructuredEditEngine(tempDir);

      const filePath = path.join(tempDir, 'utils.ts');
      fs.writeFileSync(filePath, 'export const version = "1.0.0";\n', 'utf8');

      // Natural language replace
      const patch1 = engine.fromNaturalLanguage('replace "1.0.0" with "2.0.0" in utils.ts', { authorized: true });
      expect(patch1.operations.length).toBe(1);
      expect(patch1.conflicts.length).toBe(0);

      const applied1 = engine.apply(patch1);
      expect(applied1.applied).toBe(true);
      expect(fs.readFileSync(filePath, 'utf8')).toContain('2.0.0');

      // Natural language create
      const patch2 = engine.fromNaturalLanguage('create a file config.json with "{\\"enabled\\": true}"', { authorized: true });
      expect(patch2.operations.length).toBe(1);
      engine.apply(patch2);
      expect(fs.existsSync(path.join(tempDir, 'config.json'))).toBe(true);

      // Natural language delete
      const patch3 = engine.fromNaturalLanguage('delete the file config.json because no longer needed', { authorized: true });
      expect(patch3.operations.length).toBe(1);
      engine.apply(patch3);
      expect(fs.existsSync(path.join(tempDir, 'config.json'))).toBe(false);
    });

    it('detects conflicts when file content does not match expected baseline', () => {
      const engine = new StructuredEditEngine(tempDir);
      const filePath = path.join(tempDir, 'test.ts');
      fs.writeFileSync(filePath, 'const a = 1;', 'utf8');

      const patch = engine.createPatch([
        {
          operation: 'modify',
          path: 'test.ts',
          expectedContent: 'const a = 999;', // mismatch
          content: 'const a = 2;',
          reason: 'update constant',
          authorized: true
        }
      ]);

      expect(patch.conflicts.length).toBeGreaterThan(0);
      expect(() => engine.apply(patch)).toThrow('Cannot apply conflicted patch');
    });
  });

  describe('CodingModelRouter Operations', () => {
    it('registers capabilities and selects optimal model based on privacy, context, and cost', () => {
      const router = new CodingModelRouter();

      const localModel: CodingModelCapability = {
        provider: 'ollama',
        model: 'qwen2.5-coder:7b',
        contextTokens: 32768,
        structuredOutput: true,
        toolCalling: true,
        codeQuality: 0.85,
        latencyMs: 150,
        costPer1kTokens: 0,
        local: true,
        healthy: true
      };

      const cloudModel: CodingModelCapability = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        contextTokens: 200000,
        structuredOutput: true,
        toolCalling: true,
        codeQuality: 0.98,
        latencyMs: 800,
        costPer1kTokens: 0.015,
        local: false,
        healthy: true
      };

      const mockAdapter = { generate: jest.fn() } as any;
      router.register(localModel, mockAdapter);
      router.register(cloudModel, mockAdapter);

      // Prefer local
      const selectionLocal = router.select({
        prompt: 'function add(a, b) { return a + b; }',
        privacyMode: 'strict_local'
      });
      expect(selectionLocal.supported).toBe(true);
      expect(selectionLocal.capability.local).toBe(true);

      // Cloud requirement (high context)
      const selectionCloud = router.select({
        prompt: 'analyze repository',
        minContextTokens: 100000,
        privacyMode: 'cloud_allowed'
      });
      expect(selectionCloud.supported).toBe(true);
      expect(selectionCloud.capability.provider).toBe('anthropic');
    });
  });
});
