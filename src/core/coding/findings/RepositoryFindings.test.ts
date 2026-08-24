import fs from 'fs';
import os from 'os';
import path from 'path';
import { ApprovedRepositoryGateway } from '../security/ApprovedRepositoryGateway';
import { generateCycloneDxSbom, validateCycloneDxSbom } from './CycloneDxSbom';
import { RepositoryFindingsAnalyzer } from './RepositoryFindings';
import { ingestSarif, validateSarifDocument } from './SarifAdapter';

describe('repository findings', () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf03-findings-')); fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.2.3', dependencies: { zod: '^3.0.0' } })); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  it('creates deterministic evidence-backed findings and audited scoped suppressions', () => {
    fs.writeFileSync(path.join(root, 'unsafe.ts'), "const apiKey = 'abcd1234abcdefgh'; eval('x')");
    const analyzer = new RepositoryFindingsAnalyzer(new ApprovedRepositoryGateway(root));
    const first = analyzer.analyze();
    const second = analyzer.analyze({ suppressions: new Map([[first.findings[0].id, 'Reviewed fixture-only exception']]) });
    expect(first.findings.map(value => value.id)).toEqual([...first.findings.map(value => value.id)].sort());
    expect(first.findings).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'CF03-HARDCODED-SECRET', evidence: [expect.objectContaining({ path: 'unsafe.ts', lineStart: 1 })] }), expect.objectContaining({ ruleId: 'CF03-DANGEROUS-CAPABILITY' })]));
    expect(second.findings.find(value => value.id === first.findings[0].id)).toEqual(expect.objectContaining({ suppressed: true, disposition: 'accepted_risk', suppressionReason: expect.stringContaining('Reviewed') }));
    expect(first.overlays[0]).toEqual(expect.objectContaining({ path: 'unsafe.ts', trustBoundary: true }));
  });
  it('ingests only safe SARIF 2.1 evidence locations', () => {
    const findings = ingestSarif({ version: '2.1.0', runs: [{ results: [{ ruleId: 'example-rule', level: 'warning', message: { text: 'review me' }, locations: [{ physicalLocation: { artifactLocation: { uri: 'src/a.ts' }, region: { startLine: 2 } } }] }, { locations: [{ physicalLocation: { artifactLocation: { uri: '../escape.ts' } } }] }] }] });
    expect(findings).toEqual([expect.objectContaining({ ruleId: 'example-rule', severity: 'medium', evidence: [expect.objectContaining({ path: 'src/a.ts', lineStart: 2 })] })]);
    expect(() => ingestSarif({ version: '2.0.0' })).toThrow('2.1.0');
    expect(() => validateSarifDocument({ version: '2.1.0', runs: {} as never })).toThrow('runs');
  });
  it('maps SARIF levels and defaults missing result metadata safely', () => {
    const findings = ingestSarif({ version: '2.1.0', runs: [{ tool: { driver: { name: 'fixture' } }, results: [
      { level: 'error', locations: [{ physicalLocation: { artifactLocation: { uri: 'src/error.ts' } } }] },
      { level: 'note', locations: [{ physicalLocation: { artifactLocation: { uri: 'src/note.ts' }, region: { startLine: 4, endLine: 6 } } }] }
    ] }] });
    expect(findings).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'fixture-unknown', severity: 'high', message: 'SARIF finding' }), expect.objectContaining({ severity: 'info', evidence: [expect.objectContaining({ lineStart: 4, lineEnd: 6 })] })]));
  });
  it('drops SARIF results without a safe repository location', () => {
    const findings = ingestSarif({ version: '2.1.0', runs: [{ results: [
      {},
      { locations: [{ physicalLocation: { artifactLocation: { uri: '/absolute.ts' } } }] },
      { locations: [{ physicalLocation: { artifactLocation: { uri: 'https://example.test/a.ts' } } }] },
      { locations: [{ physicalLocation: { artifactLocation: { uri: 'src/../escape.ts' } } }] }
    ] }] });
    expect(findings).toEqual([]);
  });
  it('generates a deterministic CycloneDX 1.5 document from gateway access', () => {
    const gateway = new ApprovedRepositoryGateway(root);
    expect(generateCycloneDxSbom(gateway)).toEqual(generateCycloneDxSbom(gateway));
    expect(generateCycloneDxSbom(gateway)).toEqual(expect.objectContaining({ bomFormat: 'CycloneDX', specVersion: '1.5', components: [expect.objectContaining({ name: 'zod', purl: 'pkg:npm/zod@%5E3.0.0' })] }));
    expect(() => validateCycloneDxSbom({ ...generateCycloneDxSbom(gateway), specVersion: '1.4' as '1.5' })).toThrow('Invalid');
  });
  it('uses safe defaults for unnamed dependency-free manifests and rejects invalid components', () => {
    fs.writeFileSync(path.join(root, 'package.json'), '{}');
    const bom = generateCycloneDxSbom(new ApprovedRepositoryGateway(root));
    expect(bom).toEqual(expect.objectContaining({ metadata: expect.objectContaining({ component: expect.objectContaining({ name: 'repository', version: '0.0.0' }) }), components: [] }));
    expect(() => validateCycloneDxSbom({ ...bom, components: [{ type: 'library', name: '', version: '', purl: 'invalid' }] })).toThrow('component');
  });
  it('encodes scoped packages and scans supported route-policy source files', () => {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { '@scope/pkg': '1.0.0' } }));
    fs.writeFileSync(path.join(root, 'route.yaml'), 'router.get(');
    const bom = generateCycloneDxSbom(new ApprovedRepositoryGateway(root));
    expect(bom.components[0].purl).toBe('pkg:npm/%40scope%2Fpkg@1.0.0');
    expect(new RepositoryFindingsAnalyzer(new ApprovedRepositoryGateway(root)).analyze().findings).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'CF03-ROUTE-POLICY' })]));
  });
  it('returns no synthetic dependency finding when no package manifest exists', () => {
    fs.unlinkSync(path.join(root, 'package.json'));
    expect(new RepositoryFindingsAnalyzer(new ApprovedRepositoryGateway(root)).analyze().findings).toEqual([]);
  });
});

