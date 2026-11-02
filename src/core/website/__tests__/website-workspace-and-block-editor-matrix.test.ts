import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WebsiteWorkspaceService, WebsiteProject } from '../WebsiteWorkspaceService';
import { WebsiteProjectModel } from '../WebsiteProjectModel';
import { BlockEditorEngine } from '../BlockEditorEngine';
import { WebAccessibilityAuditor } from '../WebAccessibilityAuditor';
import { WebsiteImportExportService } from '../WebsiteImportExportService';
import { ElementInspectorService } from '../ElementInspectorService';

describe('B75-06: Website Workspace, Block Editor, and Inspection Decision Matrix', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'website-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('WebsiteWorkspaceService', () => {
    it('handles load on missing file, corrupted JSON, schema v1, and schema v2', () => {
      const workspace = new WebsiteWorkspaceService(tempDir);
      expect(workspace.load()).toBeNull();

      const workspaceDir = path.join(tempDir, 'data', 'website-workspace');
      fs.mkdirSync(workspaceDir, { recursive: true });
      const projectFile = path.join(workspaceDir, 'project.json');

      // Corrupt JSON
      fs.writeFileSync(projectFile, '{ corrupt json', 'utf8');
      expect(workspace.load()).toBeNull();

      // Schema v2
      const v2Payload = {
        schemaVersion: '2.0.0',
        name: 'V2 Site',
        theme: { colors: { background: '#111', foreground: '#eee', accent: '#3b82f6' } },
        pages: [
          {
            slug: 'index',
            title: 'Home',
            blocks: [
              { type: 'hero', title: 'Welcome', body: 'Subtitle', ctaHref: '#start' },
              { type: 'features', items: [{ title: 'Speed' }, 'Reliability'] },
              { type: 'cta', title: 'Join', body: 'Sign up now', ctaHref: '#join' },
              { type: 'custom_unknown', title: 'Text block', body: 'Content' },
            ],
          },
        ],
      };
      fs.writeFileSync(projectFile, JSON.stringify(v2Payload), 'utf8');
      const loaded = workspace.load();
      expect(loaded?.name).toBe('V2 Site');
      expect(loaded?.pages[0].blocks.length).toBe(4);
      expect(loaded?.pages[0].blocks[0].type).toBe('hero');
      expect(loaded?.pages[0].blocks[3].type).toBe('text');
    });

    it('saves and renders project HTML across block types with escaping and error boundaries', () => {
      const workspace = new WebsiteWorkspaceService(tempDir);
      const project: WebsiteProject = {
        name: 'My Studio <Test>',
        theme: { background: '#000000', foreground: '#ffffff', accent: '#ff0055' },
        pages: [
          {
            slug: 'home',
            title: 'Home Page & Highlights',
            blocks: [
              { type: 'hero', title: 'Hero Title', body: 'Hero Description' },
              { type: 'features', items: ['Feature 1', 'Feature 2'] },
              { type: 'cta', title: 'Action Call', body: 'Click here', href: '/signup' },
              { type: 'text', title: 'About Us', body: 'Paragraph text' },
            ],
          },
        ],
      };

      const result = workspace.save(project);
      expect(result.project.name).toBe('My Studio <Test>');
      expect(result.html).toContain('Hero Title');
      expect(result.html).toContain('Feature 1');
      expect(result.html).toContain('Action Call');
      expect(result.html).toContain('About Us');
      expect(result.html).toContain('&lt;Test&gt;');

      expect(() => workspace.render({ name: 'Empty', pages: [] })).toThrow(
        'website project needs at least one page'
      );
      expect(() => workspace.save({ name: 'Empty', pages: [] })).toThrow(
        'website project needs at least one page'
      );
      expect(workspace.getStudio()).toBeDefined();
    });
  });

  describe('BlockEditorEngine', () => {
    it('provides block templates and executes insertion, removal, update, move, duplicate, undo, and redo', () => {
      const model = new WebsiteProjectModel();
      const engine = new BlockEditorEngine(model);

      const templates = engine.getBlockTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some((t) => t.type === 'hero')).toBe(true);

      const pageId = model.getProject().pages[0].id;
      const initialBlockCount = model.getProject().pages[0].blocks.length;

      // Add block
      const newBlock = engine.addBlock(pageId, 'pricing', 0);
      expect(model.getProject().pages[0].blocks.length).toBe(initialBlockCount + 1);
      expect(engine.canUndo()).toBe(true);

      // Update block
      engine.updateBlock(pageId, newBlock.id, { title: 'Updated Pricing Title' });
      const updated = model.getProject().pages[0].blocks.find((b) => b.id === newBlock.id);
      expect(updated?.title).toBe('Updated Pricing Title');

      // Duplicate block
      const duplicated = engine.duplicateBlock(pageId, newBlock.id);
      expect(duplicated.id).toBeDefined();
      expect(model.getProject().pages[0].blocks.length).toBe(initialBlockCount + 2);

      // Reorder block
      engine.reorderBlock(pageId, newBlock.id, 1);

      // Delete block
      const deleted = engine.deleteBlock(pageId, newBlock.id);
      expect(deleted).toBe(true);
      expect(model.getProject().pages[0].blocks.some((b) => b.id === newBlock.id)).toBe(false);

      // Undo & Redo
      expect(engine.canUndo()).toBe(true);
      engine.undo();
      expect(engine.canRedo()).toBe(true);
      engine.redo();
    });
  });

  describe('WebAccessibilityAuditor, ImportExport, and ElementInspector', () => {
    it('audits HTML and projects for accessibility issues and contrast compliance', () => {
      const auditor = new WebAccessibilityAuditor();
      const model = new WebsiteProjectModel();
      const project = model.getProject();

      const report = auditor.auditProject(project);
      expect(report.score).toBeGreaterThan(0);
      expect(report.timestamp).toBeDefined();

      // Project with violations
      const badProject: any = {
        name: 'Inaccessible Project',
        theme: { colors: { background: '#000000', foreground: '#000000' } },
        pages: [
          {
            id: 'p1',
            slug: 'bad-page',
            title: '', // Missing title
            blocks: [
              {
                id: 'b1',
                type: 'custom',
                imageUrl: 'https://example.com/pic.png',
                imageAlt: '', // Missing alt
                links: [{ label: '', href: 'https://example.com' }], // Missing link label
              },
            ],
          },
        ],
      };

      const badReport = auditor.auditProject(badProject);
      expect(badReport.issues.length).toBeGreaterThanOrEqual(4);
      expect(badReport.score).toBeLessThan(50);
    });

    it('SourceLinkInspectionService locates elements and enforces boundary constraints', () => {
      const { SourceLinkInspectionService } = require('../SourceLinkInspectionService');
      const inspector = new SourceLinkInspectionService();

      // Unconfigured fallback
      const fallback = inspector.locateSourceElement({ blockType: 'Hero', componentName: 'Hero' });
      expect(fallback?.confidence).toBe('HEURISTIC');

      // Configure dev server
      inspector.configureDevServer({
        targetUrl: 'http://localhost:5173',
        projectRoot: tempDir,
        framework: 'vite-react',
      });

      // SSRF rejection
      expect(() =>
        inspector.configureDevServer({
          targetUrl: 'https://external-malicious-domain.com',
          projectRoot: tempDir,
          framework: 'vite-react',
        })
      ).toThrow('must be a loopback address');

      // Valid dataLoc
      const loc = inspector.locateSourceElement({ dataLoc: 'src/components/Hero.tsx:12:4' });
      expect(loc?.confidence).toBe('HIGH');
      expect(loc?.startLine).toBe(12);

      // Traversal rejection
      expect(() => inspector.locateSourceElement({ dataLoc: '../../outside.tsx:1:1' })).toThrow(
        'outside project root'
      );
    });

    it('exports and imports project packages with roundtrip consistency', () => {
      const importExport = new WebsiteImportExportService();
      const sampleHtml =
        '<!DOCTYPE html><html><head><title>Demo Site</title></head><body><h1>Main Title</h1><p>Demo body text.</p></body></html>';

      const imported = importExport.importFromHtml(sampleHtml, 'Demo Site');
      expect(imported.name).toBe('Demo Site');
      expect(imported.pages[0].blocks.length).toBeGreaterThan(0);

      const exported = importExport.exportMultiPageBundle(imported);
      expect(exported.files.length).toBeGreaterThan(0);
    });

    it('inspects DOM elements and extracts computed style metadata', () => {
      const inspector = new ElementInspectorService();
      const model = new WebsiteProjectModel();
      const project = model.getProject();
      const pageId = project.pages[0].id;
      const blockId = project.pages[0].blocks[0].id;

      const element = inspector.inspectBlock(project, pageId, blockId);
      expect(element).toBeDefined();
      expect(element?.blockId).toBe(blockId);
      expect(element?.matchedStyles).toBeDefined();
    });
  });
});
