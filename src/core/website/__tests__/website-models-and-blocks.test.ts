import { WebsiteProjectModel } from '../WebsiteProjectModel';
import { BlockEditorEngine } from '../BlockEditorEngine';

describe('B75-08: Website Project Model and Block Editor Engine Matrix', () => {
  describe('WebsiteProjectModel Operations', () => {
    it('creates default project, migrates legacy v1 schemas, manages pages and design tokens', () => {
      const defaultModel = new WebsiteProjectModel();
      expect(defaultModel.getId()).toBeDefined();
      expect(defaultModel.getName()).toBeDefined();

      // Legacy v1 migration
      const legacyV1 = {
        name: 'My V1 Site',
        theme: { background: '#000000', foreground: '#ffffff' },
        pages: [
          {
            slug: 'home',
            title: 'Home Page',
            blocks: [
              {
                type: 'hero' as const,
                title: 'Welcome to V1',
                body: 'Legacy content'
              }
            ]
          }
        ]
      };

      const migratedModel = new WebsiteProjectModel(legacyV1);
      const migrated = migratedModel.getProject();
      expect(migrated.schemaVersion).toBe('2.0.0');
      expect(migrated.name).toBe('My V1 Site');
      expect(migrated.pages.length).toBe(1);
      expect(migrated.pages[0].blocks[0].type).toBe('hero');

      // Page management
      migratedModel.addPage({
        title: 'About Us',
        slug: 'about'
      });
      expect(migratedModel.getProject().pages.length).toBe(2);

      const aboutPage = migratedModel.getProject().pages.find(p => p.slug === 'about');
      expect(aboutPage).toBeDefined();

      const foundBySlug = migratedModel.getPageBySlug('about');
      expect(foundBySlug?.id).toBe(aboutPage!.id);

      migratedModel.setName('Updated Site Name');
      expect(migratedModel.getName()).toBe('Updated Site Name');

      // Custom CSS sanitization
      migratedModel.setCustomCss('<script>alert("xss")</script> body { color: red; } javascript:void(0)');
      expect(migratedModel.getCustomCss()).not.toContain('<script>');
      expect(migratedModel.getCustomCss()).toContain('body { color: red; }');

      // Export config
      migratedModel.updateExportConfig({ minify: false, generateRobotsTxt: false });
      expect(migratedModel.getProject().exportConfig?.minify).toBe(false);

      migratedModel.updatePageSEO(aboutPage!.id, { metaTitle: 'About Our Company' });
      expect(migratedModel.getPageById(aboutPage!.id)?.seo?.metaTitle).toBe('About Our Company');

      migratedModel.deletePage(aboutPage!.id);
      expect(migratedModel.getPageById(aboutPage!.id)).toBeUndefined();

      // Throws when trying to delete the only remaining page
      const remainingHome = migratedModel.getProject().pages[0];
      expect(() => migratedModel.deletePage(remainingHome.id)).toThrow('retain at least one page');

      // Theme update
      migratedModel.updateTheme({
        colors: { primary: '#10b981' },
        radii: { base: '10px' }
      });
      expect(migratedModel.getTheme().colors.primary).toBe('#10b981');

      // Empty v1 migration fallback
      const emptyV1Model = new WebsiteProjectModel({ name: 'Empty Site', pages: [] });
      expect(emptyV1Model.getPages().length).toBe(1);

      // Validate and normalize raw object
      const rawNormalized = new WebsiteProjectModel({
        schemaVersion: '2.0.0',
        id: 'p_raw',
        name: '',
        pages: [],
        createdAt: '',
        updatedAt: '',
        theme: undefined as any,
        assets: undefined as any
      });
      expect(rawNormalized.getName()).toBe('Untitled Site');
      expect(rawNormalized.getPages().length).toBe(1);
    });
  });

  describe('BlockEditorEngine Operations', () => {
    it('adds, updates, moves, duplicates, removes blocks, and supports undo/redo history', () => {
      const model = new WebsiteProjectModel();
      const editor = new BlockEditorEngine(model);

      const templates = editor.getBlockTemplates();
      expect(templates.length).toBeGreaterThan(0);

      const pageId = model.getProject().pages[0].id;

      // Add hero block
      const heroBlock = editor.addBlock(pageId, 'hero');
      expect(heroBlock.id).toBeDefined();

      // Add feature block
      const featureBlock = editor.addBlock(pageId, 'features');
      expect(featureBlock.id).toBeDefined();

      expect(editor.canUndo()).toBe(true);

      // Update block
      editor.updateBlock(pageId, heroBlock.id, { title: 'Updated Hero Title' });

      // Duplicate block
      const duplicated = editor.duplicateBlock(pageId, heroBlock.id);
      expect(duplicated.title).toContain('Updated Hero Title');

      // Reorder block
      editor.reorderBlock(pageId, duplicated.id, 0);

      // Undo changes
      expect(editor.undo()).not.toBeNull();
      expect(editor.canRedo()).toBe(true);

      // Redo changes
      expect(editor.redo()).not.toBeNull();

      // Test error branches for non-existent page and block
      expect(() => editor.addBlock('nonexistent-page', 'hero')).toThrow('not found');
      expect(() => editor.updateBlock('nonexistent-page', 'b1', {})).toThrow('not found');
      expect(() => editor.updateBlock(pageId, 'nonexistent-block', {})).toThrow('not found');
      expect(editor.deleteBlock('nonexistent-page', 'b1')).toBe(false);
      expect(editor.deleteBlock(pageId, 'nonexistent-block')).toBe(false);
      expect(() => editor.duplicateBlock('nonexistent-page', 'b1')).toThrow('not found');
      expect(() => editor.duplicateBlock(pageId, 'nonexistent-block')).toThrow('not found');
      expect(editor.reorderBlock('nonexistent-page', 'b1', 0)).toBe(false);
      expect(editor.reorderBlock(pageId, 'nonexistent-block', 0)).toBe(false);

      // Add all block template types to ensure defaultData paths are covered
      const allTypes = ['navbar', 'pricing', 'testimonial', 'gallery', 'faq', 'stats', 'contactForm', 'footer'] as const;
      for (const bType of allTypes) {
        const added = editor.addBlock(pageId, bType);
        expect(added.id).toBeDefined();
        editor.updateBlock(pageId, added.id, {
          subtitle: 'Sub',
          body: 'Content',
          eyebrow: 'Eye',
          ctaText: 'CTA',
          ctaHref: '/go',
          secondaryCtaText: 'Sec',
          secondaryCtaHref: '/sec',
          imageUrl: 'https://example.com/img.png',
          imageAlt: 'Alt',
          ariaLabel: 'Aria',
          ariaRole: 'region',
          style: { backgroundColor: '#112233' }
        });
      }

      // Delete block
      editor.deleteBlock(pageId, heroBlock.id);
    });
  });
});
