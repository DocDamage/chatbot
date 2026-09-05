/**
 * Phase PX-16: Visual Website and Click-to-Code Studio Evaluation Test Suite
 *
 * Validates:
 * - PX16-T01: Versioned website project schema & v1-to-v2 migrations
 * - PX16-T02: Block-based editor, CRUD, reorder, templates, and undo/redo history
 * - PX16-T03: Responsive live preview, sandboxed HTML, CSP meta tag, and viewport styling
 * - PX16-T04: Asset manager, dimensions, safe naming, responsive variants, and remote image load blocking
 * - PX16-T05: Element selection & inspector, box model metrics, computed style, contrast check
 * - PX16-T06: Source-linked inspection for dev servers, file/line/component mapping, confidence scoring
 * - PX16-T07: Visual edit proposals, target source files, proposed diffs, SHA-256 approval digest gate
 * - PX16-T08: Sandbox, diff & undo manager, pre-edit backups, transactional rollback, root confinement
 * - PX16-T09: Clean HTML import/export, multi-page bundle export, broken links & missing assets check
 * - PX16-T10: WebStudioService integrated workflow and state management
 * - PX16-T11: Security & injection resistance (malicious HTML, script injection, dev-server SSRF)
 * - PX16-T12: Web accessibility auditor and WCAG 2.1 AA scoring
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  WebsiteProjectModel,
  BlockEditorEngine,
  ResponsivePreviewRenderer,
  WebsiteAssetManager,
  ElementInspectorService,
  SourceLinkInspectionService,
  VisualEditProposalService,
  WebsiteSandboxUndoManager,
  WebsiteImportExportService,
  WebAccessibilityAuditor,
  WebStudioService
} from '../index';

describe('Phase PX-16: Visual Website and Click-to-Code Studio', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'px16-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // PX16-T01: Versioned Website Project Schema & Migrations
  describe('PX16-T01: Versioned Project Schema & Migrations', () => {
    it('creates a standard v2.0.0 project with design tokens, default pages, and responsive settings', () => {
      const model = new WebsiteProjectModel();
      const proj = model.getProject();

      expect(proj.schemaVersion).toBe('2.0.0');
      expect(proj.id).toMatch(/^proj-/);
      expect(proj.pages.length).toBeGreaterThan(0);
      expect(proj.theme.colors.primary).toBeDefined();
      expect(proj.theme.typography.fontFamilyBody).toBeDefined();
      expect(proj.breakpoints?.desktopMin).toBe(1025);
    });

    it('migrates legacy v1 website projects to v2.0.0 with rich blocks and normalized theme', () => {
      const legacyV1 = {
        name: 'Legacy Tech Site',
        theme: { background: '#111827', foreground: '#f9fafb', accent: '#3b82f6' },
        pages: [
          {
            slug: 'home',
            title: 'Welcome',
            blocks: [
              { type: 'hero' as const, title: 'Old Hero', body: 'Old Body' },
              { type: 'features' as const, items: ['Feature A', 'Feature B'] },
              { type: 'cta' as const, title: 'Join Us', href: 'https://example.com' }
            ]
          }
        ]
      };

      const model = new WebsiteProjectModel(legacyV1);
      const migrated = model.getProject();

      expect(migrated.schemaVersion).toBe('2.0.0');
      expect(migrated.name).toBe('Legacy Tech Site');
      expect(migrated.theme.colors.background).toBe('#111827');
      expect(migrated.pages[0].blocks).toHaveLength(3);
      expect(migrated.pages[0].blocks[0].type).toBe('hero');
    });

    it('allows page addition, slug deduplication, and SEO configuration', () => {
      const model = new WebsiteProjectModel();
      const newPage = model.addPage({ title: 'About Us', slug: 'about' });
      expect(newPage.slug).toBe('about');

      // Duplicate slug gets auto-suffixed
      const duplicatePage = model.addPage({ title: 'About Again', slug: 'about' });
      expect(duplicatePage.slug).toBe('about-1');

      model.updatePageSEO(newPage.id, {
        metaTitle: 'About Us | Custom Brand',
        metaDescription: 'Learn about our team and mission'
      });

      const updated = model.getPageById(newPage.id);
      expect(updated?.seo?.metaTitle).toBe('About Us | Custom Brand');
    });
  });

  // PX16-T02: Block Editor Engine, Templates & Undo/Redo
  describe('PX16-T02: Block Editor Engine & History', () => {
    it('provides rich block templates and allows adding, updating, and reordering blocks', () => {
      const model = new WebsiteProjectModel();
      const editor = new BlockEditorEngine(model);

      const templates = editor.getBlockTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(8);
      expect(templates.some(t => t.type === 'pricing')).toBe(true);

      const homePage = model.getPages()[0];
      const initialCount = homePage.blocks.length;

      const added = editor.addBlock(homePage.id, 'pricing', 1);
      expect(added.type).toBe('pricing');
      expect(model.getPages()[0].blocks[1].id).toBe(added.id);

      editor.updateBlock(homePage.id, added.id, { title: 'Updated Pricing Plans' });
      expect(model.getPages()[0].blocks[1].title).toBe('Updated Pricing Plans');

      // Reorder block
      editor.reorderBlock(homePage.id, added.id, 0);
      expect(model.getPages()[0].blocks[0].id).toBe(added.id);
    });

    it('supports lossless undo and redo across block modifications', () => {
      const model = new WebsiteProjectModel();
      const editor = new BlockEditorEngine(model);
      const homePage = model.getPages()[0];

      const block = editor.addBlock(homePage.id, 'faq');
      expect(editor.canUndo()).toBe(true);

      editor.updateBlock(homePage.id, block.id, { title: 'FAQ Question Set 1' });
      editor.updateBlock(homePage.id, block.id, { title: 'FAQ Question Set 2' });

      // Undo 1
      editor.undo();
      const state1 = editor.getProjectModel().getPageById(homePage.id)?.blocks.find(b => b.id === block.id);
      expect(state1?.title).toBe('FAQ Question Set 1');

      // Redo
      editor.redo();
      const state2 = editor.getProjectModel().getPageById(homePage.id)?.blocks.find(b => b.id === block.id);
      expect(state2?.title).toBe('FAQ Question Set 2');
    });
  });

  // PX16-T03: Responsive Live Preview & Strict CSP
  describe('PX16-T03: Responsive Live Preview Renderer', () => {
    it('generates HTML containing CSP headers, CSS custom properties, and semantic blocks', () => {
      const model = new WebsiteProjectModel();
      const renderer = new ResponsivePreviewRenderer();
      const html = renderer.renderPageHtml(model.getProject());

      expect(html).toContain('<!doctype html>');
      expect(html).toContain('Content-Security-Policy');
      expect(html).toContain('--color-primary:');
      expect(html).toContain('wb-hero');
      expect(html).toContain('wb-navbar');
    });

    it('renders inspection markers when inspectMode is enabled', () => {
      const model = new WebsiteProjectModel();
      const renderer = new ResponsivePreviewRenderer();
      const html = renderer.renderPageHtml(model.getProject(), { enableInspectMarkers: true });

      expect(html).toContain('data-wb-block-id=');
      expect(html).toContain('data-wb-block-type=');
    });
  });

  // PX16-T04: Asset Manager & Remote Image Security
  describe('PX16-T04: Website Asset Manager', () => {
    it('registers local assets with normalized names, dimensions, and responsive variants', () => {
      const manager = new WebsiteAssetManager();
      const asset = manager.registerAsset({
        name: 'Header Banner Final!.PNG',
        mimeType: 'image/png',
        byteSize: 1048576,
        width: 1920,
        height: 1080,
        url: '/assets/header-banner.png',
        altText: 'Modern Header Banner'
      });

      expect(asset.name).toBe('header-banner-final-.png');
      expect(asset.responsiveVariants?.length).toBe(3);
      expect(asset.responsiveVariants?.[0].width).toBe(375);
    });

    it('blocks remote images unless approvedForRemoteLoad is explicitly granted', () => {
      const manager = new WebsiteAssetManager();

      expect(() => {
        manager.registerAsset({
          name: 'Remote Tracker',
          mimeType: 'image/jpeg',
          byteSize: 5000,
          url: 'https://untrusted-external-domain.com/pixel.gif',
          altText: 'Tracker',
          approvedForRemoteLoad: false
        });
      }).toThrow(/Remote asset.*requires explicit user approval/i);

      // Succeeded with explicit approval
      const approved = manager.registerAsset({
        name: 'Approved Remote Image',
        mimeType: 'image/jpeg',
        byteSize: 15000,
        url: 'https://cdn.trusted.com/hero.jpg',
        altText: 'Hero',
        approvedForRemoteLoad: true
      });
      expect(approved.id).toBeDefined();
    });

    it('detects unused assets across project pages', () => {
      const model = new WebsiteProjectModel();
      const manager = new WebsiteAssetManager();

      const used = manager.registerAsset({
        name: 'used-logo',
        mimeType: 'image/png',
        byteSize: 2000,
        url: '/assets/logo.png',
        altText: 'Logo'
      });
      const unused = manager.registerAsset({
        name: 'unused-bg',
        mimeType: 'image/png',
        byteSize: 50000,
        url: '/assets/unused-bg.png',
        altText: 'Unused Background'
      });

      // Place used asset on home hero block
      model.getPages()[0].blocks[0].imageUrl = '/assets/logo.png';

      const unusedList = manager.detectUnusedAssets(model.getProject());
      expect(unusedList.some(a => a.id === unused.id)).toBe(true);
      expect(unusedList.some(a => a.id === used.id)).toBe(false);
    });
  });

  // PX16-T05: Element Selection & Inspector
  describe('PX16-T05: Element Selection & Inspector', () => {
    it('inspects block element, computing box model, styles, and color contrast', () => {
      const model = new WebsiteProjectModel();
      const inspector = new ElementInspectorService();
      const homePage = model.getPages()[0];
      const heroBlock = homePage.blocks.find(b => b.type === 'hero')!;

      const inspection = inspector.inspectBlock(model.getProject(), homePage.id, heroBlock.id);
      expect(inspection).not.toBeNull();
      expect(inspection?.elementId).toBe(`elem-${heroBlock.id}`);
      expect(inspection?.boxModel.padding.top).toBe(80);
      expect(inspection?.computedContrast?.passesAA).toBe(true);
    });

    it('calculates WCAG contrast ratios accurately', () => {
      const inspector = new ElementInspectorService();

      // White on Black -> ~21:1
      const highContrast = inspector.calculateContrast('#ffffff', '#000000');
      expect(highContrast.ratio).toBeGreaterThanOrEqual(20);
      expect(highContrast.passesAA).toBe(true);
      expect(highContrast.passesAAA).toBe(true);

      // Light gray on white -> < 3:1 (fail)
      const lowContrast = inspector.calculateContrast('#aaaaaa', '#ffffff');
      expect(lowContrast.passesAA).toBe(false);
    });
  });

  // PX16-T06: Source-Linked Inspection
  describe('PX16-T06: Source-Linked Inspection', () => {
    it('locates source files inside confined projectRoot and prevents source-map path traversal', () => {
      const linker = new SourceLinkInspectionService();

      // Fake dev server project
      const fakeProjDir = path.join(tempDir, 'fake-app');
      fs.mkdirSync(path.join(fakeProjDir, 'src', 'components'), { recursive: true });
      fs.writeFileSync(path.join(fakeProjDir, 'src', 'components', 'HeroSection.tsx'), 'export const HeroSection = () => null;');

      linker.configureDevServer({
        targetUrl: 'http://localhost:5173',
        projectRoot: fakeProjDir,
        framework: 'vite-react'
      });

      // High confidence lookup with dataLoc
      const exactMatch = linker.locateSourceElement({
        dataLoc: 'src/components/HeroSection.tsx:10:2'
      });
      expect(exactMatch?.confidence).toBe('HIGH');
      expect(exactMatch?.filePath).toBe('src/components/HeroSection.tsx');
      expect(exactMatch?.startLine).toBe(10);

      // Escape attempt outside root throws error
      expect(() => {
        linker.locateSourceElement({
          dataLoc: '../../../etc/passwd:1:1'
        });
      }).toThrow(/Source-map escape attempted/i);

      const siblingPrefixPath = `${fakeProjDir}-outside`;
      fs.mkdirSync(siblingPrefixPath, { recursive: true });
      try {
        expect(() => {
          linker.locateSourceElement({
            dataLoc: `../${path.basename(siblingPrefixPath)}/secret.tsx:1:1`
          });
        }).toThrow(/Source-map escape attempted/i);
      } finally {
        fs.rmSync(siblingPrefixPath, { recursive: true, force: true });
      }
    });

    it('rejects remote non-loopback host targets for dev server', () => {
      const linker = new SourceLinkInspectionService();
      expect(() => {
        linker.configureDevServer({
          targetUrl: 'http://192.168.1.100:3000',
          projectRoot: tempDir,
          framework: 'vite-react'
        });
      }).toThrow(/must be a loopback address/i);
    });
  });

  // PX16-T07: Visual Edit Proposals & Digest Gate
  describe('PX16-T07: Visual Edit Proposals & Approval Digest Gate', () => {
    it('creates proposals with SHA-256 digest and strictly blocks mutation until exact digest approval', () => {
      const proposalService = new VisualEditProposalService();
      const proposal = proposalService.createProposal({
        projectId: 'proj-123',
        targetBlockId: 'block-456',
        instruction: 'Change hero heading to bold typography',
        targetFiles: ['src/components/Hero.tsx'],
        diff: '- <h1>Hello</h1>\n+ <h1><strong>Hello</strong></h1>',
        summary: 'Updated heading font weight'
      });

      expect(proposal.approvalDigest).toHaveLength(64);
      expect(proposal.status).toBe('PENDING_APPROVAL');

      // Attempting to apply without approval throws
      expect(() => {
        proposalService.applyProposal(proposal.id);
      }).toThrow(/Cannot apply unapproved proposal/i);

      // Approving with incorrect digest throws
      expect(() => {
        proposalService.approveProposal(proposal.id, 'tampered-digest-0000');
      }).toThrow(/Approval digest mismatch/i);

      // Approving with valid digest succeeds
      const approved = proposalService.approveProposal(proposal.id, proposal.approvalDigest);
      expect(approved.status).toBe('APPROVED');

      // Applying approved proposal succeeds
      const applied = proposalService.applyProposal(proposal.id);
      expect(applied.status).toBe('APPLIED');
    });
  });

  // PX16-T08: Website Sandbox Undo Manager
  describe('PX16-T08: Sandbox Writes & Transactional Rollback', () => {
    it('manages transactional file edits and restores byte-for-byte pre-edit state on rollback', () => {
      const sandbox = new WebsiteSandboxUndoManager(tempDir);
      const testFilePath = 'src/pages/Home.html';
      const initialBytes = '<html><body>Initial Version</body></html>';

      const fullPath = path.join(tempDir, testFilePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, initialBytes, 'utf8');

      const txId = sandbox.beginTransaction('prop-test-1');
      sandbox.stageFileWrite(txId, testFilePath, '<html><body>Modified Version 2</body></html>');

      expect(fs.readFileSync(fullPath, 'utf8')).toContain('Modified Version 2');

      // Rollback
      const rolledBack = sandbox.rollbackTransaction(txId);
      expect(rolledBack).toBe(true);
      expect(fs.readFileSync(fullPath, 'utf8')).toBe(initialBytes);
    });

    it('enforces file write confinement within project root', () => {
      const sandbox = new WebsiteSandboxUndoManager(tempDir);
      const txId = sandbox.beginTransaction();

      expect(() => {
        sandbox.stageFileWrite(txId, '../../outside.txt', 'malicious content');
      }).toThrow(/Write confinement violation/i);
    });
  });

  // PX16-T09: Website Import & Export Service
  describe('PX16-T09: HTML Import & Multi-Page Export Bundle', () => {
    it('sanitizes imported HTML, strips dangerous script tags, and reconstructs structured blocks', () => {
      const service = new WebsiteImportExportService();
      const maliciousHtml = `
        <!doctype html>
        <html>
          <head><title>My Clean Company</title><script>alert("pwned")</script></head>
          <body>
            <h1>Welcome to Clean Company</h1>
            <p>We build safe cloud infrastructure.</p>
            <p>Our tools are verified by third parties.</p>
            <iframe src="http://evil.com"></iframe>
          </body>
        </html>
      `;

      const project = service.importFromHtml(maliciousHtml, 'Clean Company Site');
      expect(project.name).toBe('Clean Company Site');
      expect(project.pages[0].blocks.some(b => b.type === 'hero')).toBe(true);

      const exportedHtml = service.exportCleanHtml(project);
      expect(exportedHtml).not.toContain('alert("pwned")');
      expect(exportedHtml).not.toContain('evil.com');
    });

    it('exports multi-page ZIP bundle with sitemap.xml and robots.txt', () => {
      const model = new WebsiteProjectModel();
      model.addPage({ title: 'Contact', slug: 'contact' });

      const service = new WebsiteImportExportService();
      const bundle = service.exportMultiPageBundle(model.getProject());

      expect(bundle.files.some(f => f.path === 'index.html')).toBe(true);
      expect(bundle.files.some(f => f.path === 'contact.html')).toBe(true);
      expect(bundle.files.some(f => f.path === 'sitemap.xml')).toBe(true);
      expect(bundle.files.some(f => f.path === 'robots.txt')).toBe(true);
      expect(bundle.totalBytes).toBeGreaterThan(0);
    });

    it('validates internal links and detects broken routes', () => {
      const model = new WebsiteProjectModel();
      const home = model.getPages()[0];
      home.blocks[0].ctaHref = '/non-existent-page.html';

      const service = new WebsiteImportExportService();
      const validation = service.validateProjectLinksAndAssets(model.getProject());

      expect(validation.valid).toBe(false);
      expect(validation.brokenLinks.length).toBeGreaterThan(0);
      expect(validation.brokenLinks[0].href).toBe('/non-existent-page.html');
    });
  });

  // PX16-T10 & PX16-T12: WebStudioService Integrated Surface & Accessibility Auditor
  describe('PX16-T10 & PX16-T12: WebStudioService & Accessibility Auditing', () => {
    it('coordinates block edits, inspector, proposals, and accessibility audits in unified service', () => {
      const studio = new WebStudioService(tempDir);
      const proj = studio.getProject();
      expect(proj.pages.length).toBe(1);

      // Add block
      const added = studio.addBlock(proj.pages[0].id, 'pricing');
      expect(added.type).toBe('pricing');

      // Create proposal and approve
      const proposal = studio.createEditProposal({
        targetBlockId: added.id,
        instruction: 'Set pricing title to Pro Tier',
        targetFiles: ['project.json'],
        diff: '+ Pro Tier',
        summary: 'Updated title',
        blockMutation: { title: 'Pro Tier Special' }
      });

      const approved = studio.approveEditProposal(proposal.id, proposal.approvalDigest);
      const appliedResult = studio.applyEditProposal(approved.id);
      expect(appliedResult.proposal.status).toBe('APPLIED');

      // Inspect updated block
      const inspected = studio.inspectElement(proj.pages[0].id, added.id);
      expect(inspected?.matchedStyles).toBeDefined();

      // Accessibility audit
      const audit = studio.runAccessibilityAudit();
      expect(audit.score).toBeGreaterThan(80);
      expect(audit.totalChecks).toBeGreaterThan(0);
    });
  });
});
