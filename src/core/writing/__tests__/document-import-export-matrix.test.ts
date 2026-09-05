import { DocumentImportExportService } from '../DocumentImportExportService';
import { WritingStudioService } from '../WritingStudioService';

describe('B75-08: DocumentImportExportService & WritingStudioService Deep Matrix', () => {
  describe('DocumentImportExportService', () => {
    let service: DocumentImportExportService;

    beforeEach(() => {
      service = new DocumentImportExportService();
    });

    it('imports markdown, html, text, docx, and pdf representations into CanonicalDocument', () => {
      // Markdown import
      const mdImport = service.importDocument('# Title\n\nSome body text.', 'markdown', 'test.md');
      expect(mdImport.isLossless).toBe(true);
      expect(mdImport.document.rawText).toContain('Some body text');

      // Text import
      const textImport = service.importDocument('Plain raw text.', 'text', 'test.txt');
      expect(textImport.isLossless).toBe(true);

      // HTML import
      const html = '<h1>Heading 1</h1><h2>Heading 2</h2><p><strong>Bold</strong> and <em>italic</em> with <a href="https://example.com">link</a></p><pre><code>console.log(1);</code></pre>';
      const htmlImport = service.importDocument(html, 'html', 'test.html');
      expect(htmlImport.isLossless).toBe(false);
      expect(htmlImport.document.rawText).toContain('# Heading 1');
      expect(htmlImport.document.rawText).toContain('**Bold**');

      // DOCX mock buffer import
      const docxImport = service.importDocument(Buffer.from('Mock DOCX document body'), 'docx', 'test.docx');
      expect(docxImport.isLossless).toBe(false);

      // PDF mock buffer import
      const pdfImport = service.importDocument(Buffer.from('%PDF-1.4 mock text'), 'pdf', 'test.pdf');
      expect(pdfImport.isLossless).toBe(false);

      // Throws on unsupported format
      expect(() => service.importDocument('data', 'unsupported' as any)).toThrow('Unsupported import format');
    });

    it('exports CanonicalDocument to markdown, html, pdf_html, and docx_xml', () => {
      const doc = service.importDocument('# Chapter 1\n\n> [!NOTE] Essential tip.\n\nBody text <!-- hidden comment -->', 'markdown', 'book.md').document;

      // Export Markdown with stripped comments
      const mdExport = service.exportDocument(doc, 'markdown', { stripComments: true });
      expect(mdExport.format).toBe('markdown');
      expect(mdExport.content).not.toContain('<!-- hidden comment -->');

      // Export HTML
      const htmlExport = service.exportDocument(doc, 'html');
      expect(htmlExport.format).toBe('html');
      expect(htmlExport.content).toContain('<h1>Chapter 1</h1>');
      expect(htmlExport.content).toContain('callout-NOTE');

      // Export PDF HTML
      const pdfExport = service.exportDocument(doc, 'pdf_html');
      expect(pdfExport.format).toBe('pdf_html');
      expect(pdfExport.content).toContain('@media print');

      // Export DOCX XML
      const docxExport = service.exportDocument(doc, 'docx_xml');
      expect(docxExport.format).toBe('docx_xml');
      expect(docxExport.content).toContain('<w:document');

      // Throws on invalid format
      expect(() => service.exportDocument(doc, 'invalid' as any)).toThrow('Unsupported export format');
    });
  });

  describe('WritingStudioService', () => {
    let writingStudio: WritingStudioService;

    beforeEach(() => {
      writingStudio = new WritingStudioService();
    });

    it('manages document creation, revision sessions, export, and continuity checks', () => {
      const doc = writingStudio.openDocument('# Chapter 1\n\nIt was a quiet night.', 'Novel Draft');
      expect(doc.id).toBeDefined();

      const active = writingStudio.getActiveDocument();
      expect(active?.id).toBe(doc.id);

      // Update text
      const updated = writingStudio.updateDocumentText('# Chapter 1\n\nIt was a dark and stormy night.');
      expect(updated.rawText).toContain('dark and stormy');

      // Outline and proofreading
      const outline = writingStudio.getOutline();
      expect(outline.totalWordCount).toBeGreaterThan(0);

      const suggestions = writingStudio.runProofreadingScan();
      expect(Array.isArray(suggestions)).toBe(true);

      // Comments
      const commentRange = { startOffset: 0, endOffset: 10, startLine: 1, endLine: 1, startColumn: 1, endColumn: 10 };
      const comment = writingStudio.addComment(commentRange, 'reviewer_1', 'Great intro');
      expect(comment.id).toBeDefined();

      // Tracked changes
      const change = writingStudio.recordTrackedChange('insertion', commentRange, 'reviewer_1', 'It was a cold and dark night.');
      expect(change.id).toBeDefined();

      const acceptedAll = writingStudio.acceptAllTrackedChanges();
      expect(acceptedAll.id).toBeDefined();

      // Accessibility & View Mode
      const access = writingStudio.updateAccessibility({ highContrast: true, dyslexicFont: true });
      expect(access.highContrast).toBe(true);

      writingStudio.setViewMode('split');

      // Studio state
      const state = writingStudio.getStudioState();
      expect(state.activeDocument?.id).toBe(doc.id);
      expect(state.comments.length).toBe(1);

      // Accessors
      expect(writingStudio.getEditorEngine()).toBeDefined();
      expect(writingStudio.getProofreader()).toBeDefined();
      expect(writingStudio.getImportExport()).toBeDefined();
      expect(writingStudio.getRecoveryManager()).toBeDefined();
      expect(writingStudio.getAIRouter()).toBeDefined();
    });
  });
});
