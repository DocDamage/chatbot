/**
 * Repository Intelligence Evaluation & Verification Suite (PX-04)
 */

import { ByteOffsetSymbolIndex, StaleOffsetError } from '../indexes/ByteOffsetSymbolIndex';
import { MultiLanguageSymbolIndexer } from '../indexes/MultiLanguageSymbolIndexer';
import { SemanticArchitectureCardProvider } from '../architecture/SemanticArchitectureCardProvider';
import { GitIntelligenceProvider } from '../git/GitIntelligenceProvider';
import { CodeHealthRiskProvider } from '../risk/CodeHealthRiskProvider';
import { DiffImpactAnalyzer } from '../impact/DiffImpactAnalyzer';
import { SafeRepositoryIngester } from '../ingestion/SafeRepositoryIngester';
import * as fs from 'fs';
import * as path from 'path';

describe('Repository Intelligence (PX-04)', () => {
  const testWorkspace = path.resolve(__dirname, '../../../../');
  let symbolIndex: ByteOffsetSymbolIndex;
  let indexer: MultiLanguageSymbolIndexer;

  beforeEach(() => {
    symbolIndex = new ByteOffsetSymbolIndex(testWorkspace);
    indexer = new MultiLanguageSymbolIndexer(symbolIndex);
  });

  describe('PX04-T01: Byte-Offset Symbol Index & Stale Offset Rejection', () => {
    it('indexes symbols with exact byte offsets and retrieves source slice', () => {
      const sampleCode = `export class UserService {\n  public getUser(id: string): User {\n    return { id };\n  }\n}`;
      const symbols = indexer.indexFile('src/user/UserService.ts', sampleCode);

      expect(symbols.length).toBeGreaterThan(0);
      const classSymbol = symbols.find(s => s.name === 'UserService');
      expect(classSymbol).toBeDefined();
      expect(classSymbol?.kind).toBe('class');
      expect(classSymbol?.byteOffset).toBe(13);
      expect(classSymbol?.byteLength).toBe(11);
    });

    it('rejects stale offset reads when file content digest mismatches', () => {
      const originalCode = `export function calculateTotal(a: number, b: number): number {\n  return a + b;\n}`;
      const tempFilePath = path.join(testWorkspace, 'temp_stale_test.ts');

      try {
        fs.writeFileSync(tempFilePath, originalCode, 'utf8');
        const symbols = indexer.indexFile(tempFilePath, originalCode);
        const funcSym = symbols.find(s => s.name === 'calculateTotal')!;

        // Modify file on disk to simulate external edit
        fs.writeFileSync(tempFilePath, `// Comment line added\n` + originalCode, 'utf8');

        // Attempting to retrieve using old offset must throw StaleOffsetError
        expect(() => {
          symbolIndex.retrieveSymbolSource(funcSym.id);
        }).toThrow(StaleOffsetError);
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      }
    });
  });

  describe('PX04-T02: Multi-Language Symbol Indexing & Health Reporting', () => {
    it('indexes Python, Go, Rust, and GDScript code accurately', () => {
      const pyCode = `class DataProcessor:\n    def process(self, data):\n        pass\n`;
      const pySymbols = indexer.indexFile('scripts/process.py', pyCode);
      expect(pySymbols.some(s => s.name === 'DataProcessor' && s.kind === 'class')).toBe(true);
      expect(pySymbols.some(s => s.name === 'process' && s.kind === 'method')).toBe(true);

      const goCode = `package main\n\ntype ServerConfig struct {}\n\nfunc StartServer() error {\n  return nil\n}\n`;
      const goSymbols = indexer.indexFile('cmd/server.go', goCode);
      expect(goSymbols.some(s => s.name === 'ServerConfig' && s.kind === 'struct')).toBe(true);
      expect(goSymbols.some(s => s.name === 'StartServer' && s.kind === 'function')).toBe(true);

      const rsCode = `pub struct GameState {}\n\npub fn update_state() {}\n`;
      const rsSymbols = indexer.indexFile('src/state.rs', rsCode);
      expect(rsSymbols.some(s => s.name === 'GameState' && s.kind === 'struct')).toBe(true);
      expect(rsSymbols.some(s => s.name === 'update_state' && s.kind === 'function')).toBe(true);

      const gdCode = `class_name PlayerController\n\nfunc jump():\n    pass\n`;
      const gdSymbols = indexer.indexFile('scripts/Player.gd', gdCode);
      expect(gdSymbols.some(s => s.name === 'PlayerController' && s.kind === 'class')).toBe(true);
      expect(gdSymbols.some(s => s.name === 'jump' && s.kind === 'function')).toBe(true);

      const health = indexer.getHealthReports();
      expect(health.length).toBeGreaterThanOrEqual(4);
      expect(health.every(h => h.symbolsExtracted > 0)).toBe(true);
    });
  });

  describe('PX04-T03: Semantic Architecture Cards & Crux Excerpts', () => {
    it('creates semantic architecture cards with preserved human notes and Mermaid export', () => {
      const cardProvider = new SemanticArchitectureCardProvider();
      const card = cardProvider.createCard({
        subsystem: 'auth',
        title: 'Authentication & Session Service',
        purpose: 'Handles session cookies, JWT verification, and user authentication.',
        sourceFiles: [{ filePath: 'src/core/auth/AuthService.ts', content: 'export class AuthService {}' }],
        keySymbols: [{ name: 'AuthService', kind: 'class', filePath: 'src/core/auth/AuthService.ts' }],
        cruxExcerpts: [{
          filePath: 'src/core/auth/AuthService.ts',
          startLine: 1,
          endLine: 1,
          codeSnippet: 'export class AuthService {}',
          explanation: 'Core auth controller',
          sourceDigest: 'abc'
        }],
        typedLinks: [{ targetCardId: 'card_user', relationship: 'depends_on' }],
        humanNotes: 'Initial security review passed on 2026-08-20'
      });

      expect(card.id).toBe('card_auth');
      expect(card.humanNotes).toContain('Initial security review passed');

      // Update human notes
      cardProvider.updateHumanNotes('card_auth', 'Updated notes: MFA enabled');
      expect(cardProvider.getCard('card_auth')?.humanNotes).toBe('Updated notes: MFA enabled');

      // Mermaid diagram export
      const mermaid = cardProvider.exportToMermaid();
      expect(mermaid).toContain('graph TD');
      expect(mermaid).toContain('card_auth -->|depends_on| card_user');
    });
  });

  describe('PX04-T04 & PX04-T05: Git Intelligence & Code Health Risk Provider', () => {
    it('detects oversized functions, complexity, and computes hotspot ranking', () => {
      const riskProvider = new CodeHealthRiskProvider(testWorkspace);
      const complexCode = [
        'function complexProcess(a, b) {',
        '  if (a) {',
        '    for (let i = 0; i < 10; i++) {',
        '      if (b && i > 5) {',
        '        eval("console.log(i)");',
        '      }',
        '    }',
        '  }',
        '}'
      ].join('\n');

      const { findings, hotspots } = riskProvider.analyzeCodeHealth([
        { filePath: 'src/complex.ts', content: complexCode }
      ], new Map([['src/complex.ts', 15]]));

      expect(findings.some(f => f.ruleId === 'SECURITY_DANGEROUS_EXECUTION')).toBe(true);
      expect(hotspots.length).toBe(1);
      expect(hotspots[0].filePath).toBe('src/complex.ts');
      expect(hotspots[0].hotspotScore).toBeGreaterThan(0);
    });
  });

  describe('PX04-T06: Diff Impact Analyzer', () => {
    it('calculates changed symbols and test impact from unified diff', () => {
      const code = `export class OrderService {\n  public createOrder(): void {}\n  public cancelOrder(): void {}\n}`;
      indexer.indexFile('src/services/OrderService.ts', code);

      const analyzer = new DiffImpactAnalyzer(symbolIndex, ['src/services/OrderService.test.ts']);
      const sampleDiff = [
        'diff --git a/src/services/OrderService.ts b/src/services/OrderService.ts',
        '--- a/src/services/OrderService.ts',
        '+++ b/src/services/OrderService.ts',
        '@@ -2,2 +2,2 @@',
        '-  public createOrder(): void {}',
        '+  public createOrder(urgent: boolean): void {}'
      ].join('\n');

      const report = analyzer.analyzePatchImpact(sampleDiff);
      expect(report.changedFiles).toContain('src/services/OrderService.ts');
      expect(report.affectedSymbols.some((s: any) => s.symbol.name === 'createOrder' || s.symbol.name === 'OrderService')).toBe(true);
      expect(report.affectedTests).toContain('src/services/OrderService.test.ts');
      expect(report.isBreakingContractRisk).toBe(true);
    });
  });

  describe('PX04-T07: Safe Repository Ingester', () => {
    it('scans target directory with size bounds and prevents path traversal', () => {
      const result = SafeRepositoryIngester.inspectRepository(path.join(testWorkspace, 'src/core/repository-intelligence'), {
        maxFiles: 50,
        maxTotalBytes: 5 * 1024 * 1024
      });

      expect(result.success).toBe(true);
      expect(result.ingestedFilesCount).toBeGreaterThan(0);
      expect(result.repositoryDigest).toBeDefined();
      expect(result.files.every(f => !f.relativePath.startsWith('..'))).toBe(true);
    });

    it('honors a normalized allowed-extension boundary', () => {
      const result = SafeRepositoryIngester.inspectRepository(path.join(testWorkspace, 'src/core/repository-intelligence'), {
        maxFiles: 50,
        maxTotalBytes: 5 * 1024 * 1024,
        allowedExtensions: ['TS']
      });

      expect(result.success).toBe(true);
      expect(result.ingestedFilesCount).toBeGreaterThan(0);
      expect(result.files.every(file => file.relativePath.toLowerCase().endsWith('.ts'))).toBe(true);
    });

    it('accepts dotted extension filters with default ingestion limits', () => {
      const result = SafeRepositoryIngester.inspectRepository(path.join(testWorkspace, 'src/core/repository-intelligence'), {
        allowedExtensions: ['.TS']
      });

      expect(result.success).toBe(true);
      expect(result.ingestedFilesCount).toBeGreaterThan(0);
      expect(result.files.every(file => file.relativePath.toLowerCase().endsWith('.ts'))).toBe(true);
    });

    it('reports when the file-count boundary truncates ingestion', () => {
      const result = SafeRepositoryIngester.inspectRepository(path.join(testWorkspace, 'src/core/repository-intelligence'), {
        maxFiles: 1,
        maxTotalBytes: 5 * 1024 * 1024
      });

      expect(result.success).toBe(true);
      expect(result.ingestedFilesCount).toBe(1);
      expect(result.warnings).toContain('File count cap of 1 reached; remaining files skipped.');
    });
  });
});
