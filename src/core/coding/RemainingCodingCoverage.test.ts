import fs from 'fs';
import os from 'os';
import path from 'path';
import { CodingController } from './CodingController';
import { CodingRequestRouter } from './CodingRequestRouter';
import { WorkspaceWriteGate } from './editing/WorkspaceWriteGate';
import { StructuredEditEngine } from './editing/StructuredEditEngine';
import { SymbolIndex } from './index/SymbolIndex';
import { CodingKnowledgeAuthority } from './knowledge/CodingKnowledgeAuthority';
import { CodingModelRouter } from './model/CodingModelRouter';
import { StructuralRetriever } from './retrieval/StructuralRetriever';
import { RepositorySnapshot } from './repository/RepositoryIntelligence';
import { VerificationOrchestrator } from './verification/VerificationOrchestrator';

describe('coding capability integration coverage', () => {
  it('routes typed tasks and produces a bounded report', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-controller-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), '{"scripts":{}}');
      const task = new CodingRequestRouter().route('Fix src/app.ts function loadUser', 'implement');
      expect(task.affectedFiles).toContain('src/app.ts');
      const result = await new CodingController(root).inspectAndReport('review the change', { mode: 'plan', runVerification: false });
      expect(result.stages).toEqual(['inspect', 'plan', 'edit', 'review', 'verify', 'report']);
      expect(result.verification.status).toBe('not_run');
      expect(result.testStrategy.cases.length).toBeGreaterThan(0);
      expect(result.repair).toBeUndefined();
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('enforces the write gate separately from patch construction', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-gate-'));
    try {
      fs.writeFileSync(path.join(root, 'a.ts'), 'a');
      const patch = new StructuredEditEngine(root).createPatch([{ operation: 'modify', path: 'a.ts', expectedContent: 'a', content: 'b', reason: 'fix', authorized: true }]);
      const gate = new WorkspaceWriteGate();
      expect(() => gate.assertCanApply('plan', patch)).toThrow(/not allowed/);
      expect(() => gate.assertCanApply('implement', patch)).not.toThrow();
      expect(() => gate.assertCanApply('debug', patch)).not.toThrow();
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('selects coding models by capacity, structure, quality, and cost', () => {
    const router = new CodingModelRouter();
    router.register({ provider: 'local', model: 'code', contextTokens: 10000, structuredOutput: true, toolCalling: true, codeQuality: 0.8, latencyMs: 50, costPer1kTokens: 0, local: true });
    expect(router.select({ prompt: 'implement a feature', requiresStructuredOutput: true }).capability.model).toBe('code');
    expect(router.select({ prompt: 'x'.repeat(100), minContextTokens: 100000 }).supported).toBe(false);
  });

  it('retrieves symbols, instructions, tests, and user paths structurally', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-retrieval-'));
    try {
      fs.mkdirSync(path.join(root, 'src'), { recursive: true });
      fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
      fs.writeFileSync(path.join(root, 'src', 'app.ts'), 'export function loadUser() { return true; }');
      fs.writeFileSync(path.join(root, 'tests', 'app.test.ts'), 'test loadUser');
      fs.writeFileSync(path.join(root, 'package.json'), '{"scripts":{"test":"jest"}}');
      const index = new SymbolIndex(root); index.indexFiles(['src/app.ts']);
      const snapshot = { root, version: '1', files: [
        { path: 'src/app.ts', size: 45, language: 'typescript', generated: false, binary: false },
        { path: 'tests/app.test.ts', size: 15, language: 'typescript', generated: false, binary: false },
        { path: 'package.json', size: 28, language: 'json', generated: false, binary: false }
      ], projectRoots: [], instructions: [{ path: 'AGENTS.md', scope: '.', content: 'Keep changes minimal.', precedence: 0, trustedForPolicy: false }], manifests: [{ path: 'package.json', kind: 'package.json', data: { scripts: { test: 'jest' } } }], languages: { languages: [], frameworks: [], conflicts: [] }, buildSystems: ['npm'], commandPlans: [{ executable: 'npm', argv: ['test'], purpose: 'test', source: 'typescript', supported: true }], relationships: [{ from: 'src/app.ts', to: 'tests/app.test.ts', kind: 'tests', confidence: 0.9 }], parserHealth: [] } as RepositorySnapshot;
      const retriever = new StructuralRetriever(root, snapshot, index);
      const evidence = retriever.retrieve({ query: 'loadUser', symbols: ['loadUser'] });
      const userPathEvidence = retriever.retrieve({ query: 'loadUser', files: ['src/app.ts'] });
      expect(evidence.some(item => item.reason.includes('definition'))).toBe(true);
      expect(userPathEvidence.some(item => item.path === 'package.json' && item.kind === 'dependency')).toBe(true);
      expect(userPathEvidence.some(item => item.path === 'tests/app.test.ts' && item.kind === 'test')).toBe(true);
      expect(userPathEvidence.some(item => item.path === 'AGENTS.md' && item.kind === 'instruction')).toBe(true);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('reports an honest blocked verification when no project command is detected', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-verify-'));
    try { expect((await new VerificationOrchestrator(root).verify()).status).toBe('blocked'); }
    finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('ranks and exposes coding knowledge by authority', () => {
    const knowledge = new CodingKnowledgeAuthority();
    knowledge.add({ id: 'repo', title: 'repo fix', content: 'local truth', authority: 'repository', tags: ['fix'], verificationStatus: 'verified', provenance: ['repo'] });
    knowledge.add({ id: 'learned', title: 'learned fix', content: 'local truth', authority: 'learned', tags: ['fix'], verificationStatus: 'unverified', provenance: ['interaction'] });
    expect(knowledge.search('fix')[0].id).toBe('repo');
    expect(knowledge.classify(knowledge.all()[1])).toBe('learned');
  });
});
