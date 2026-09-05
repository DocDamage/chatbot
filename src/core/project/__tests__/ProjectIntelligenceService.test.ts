import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ProjectIntelligenceService } from '../ProjectIntelligenceService';

describe('RT-PROJ-001: ProjectIntelligenceService Analysis, Hotspots, and History Suite', () => {
  let tempDir: string;
  let service: ProjectIntelligenceService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-intelligence-test-'));
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test-project', description: 'Test project description' }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'src', 'index.ts'),
      'export function main() {\n  if (true) {\n    return 42;\n  }\n}\n// Repeated line for duplicate candidate detection long enough\nexport const someSharedConstantDefinitionValue = "repeated-constant-definition-across-files";\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'src', 'util.ts'),
      'export function helper() {\n  return 1;\n}\nexport const someSharedConstantDefinitionValue = "repeated-constant-definition-across-files";\n',
      'utf8'
    );

    service = new ProjectIntelligenceService(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('computes project overview, hotspots, duplicate candidates, and recommendations', async () => {
    const overview = await service.overview(50);
    expect(overview.project).toBeDefined();
    expect(overview.summary.files).toBeGreaterThanOrEqual(2);
    expect(overview.summary.lines).toBeGreaterThan(0);
    expect(overview.hotspots.length).toBeGreaterThan(0);
    expect(overview.recommendations.length).toBeGreaterThan(0);
  });

  it('inspects individual files with complexity and symbol details', () => {
    const insight = service.inspect('src/index.ts');
    expect(insight.path).toBe('src/index.ts');
    expect(insight.lines).toBeGreaterThan(0);
    expect(insight.complexity).toBeGreaterThanOrEqual(1);
    expect(insight.risk).toBeGreaterThan(0);

    // Path traversal guard
    expect(() => service.inspect('../outside.ts')).toThrow('File must be inside the workspace');
  });

  it('reads git history safely without exploding outside a git repo', () => {
    const history = service.history(5);
    expect(Array.isArray(history)).toBe(true);
  });
});
