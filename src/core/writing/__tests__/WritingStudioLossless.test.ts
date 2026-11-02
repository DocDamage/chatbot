import { DocumentImportExportService } from '../DocumentImportExportService';
import { TrackedChangesManager } from '../TrackedChangesManager';
import { AIProposalService } from '../AIProposalService';
import { CanonicalDocument } from '../WritingTypes';

describe('RT-WRITE-001..002 — Lossless Document Matrix, Tracked Changes and AI Proposals', () => {
  const service = new DocumentImportExportService();

  describe('RT-WRITE-001: Lossless Document Matrix', () => {
    it('round-trips Markdown documents preserving front-matter, headings, and code blocks', () => {
      const originalMarkdown = `# Document Title\n\nThis is introductory text.\n\n## Section 1\n- Item 1\n- Item 2\n\n\`\`\`typescript\nconst x: number = 42;\n\`\`\`\n`;

      const result = service.importDocument(originalMarkdown, 'markdown', 'test-doc');
      expect(result.document.id).toBeDefined();
      expect(result.isLossless).toBe(true);

      const exported = service.exportDocument(result.document, 'markdown');
      expect(exported.content.toString('utf8')).toContain('# Document Title');
      expect(exported.content.toString('utf8')).toContain('const x: number = 42;');
    });
  });

  describe('RT-WRITE-002: Tracked Changes & Comments', () => {
    it('adds threaded comments and supports resolve workflow', () => {
      const doc: CanonicalDocument = {
        id: 'doc-1',
        rawText: 'Hello world of writing.',
        metadata: {
          id: 'doc-1',
          title: 'Sample Doc',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0',
          lineEnding: 'LF',
          bom: 'none',
          hasFinalNewline: true,
          byteSize: 23,
          sha256Digest: 'dummy-sha',
          sensitivity: 'internal',
        },
        astVersion: '1.0',
        isDirty: false,
      };

      const comment = TrackedChangesManager.addComment(
        doc,
        {
          startOffset: 0,
          endOffset: 5,
          startLine: 1,
          endLine: 1,
          startColumn: 1,
          endColumn: 6,
        },
        'Editor',
        'Check greeting'
      );

      expect(comment.selectedText).toBe('Hello');
      expect(comment.resolved).toBe(false);

      const resolved = TrackedChangesManager.setCommentResolved(comment, true, 'Author');
      expect(resolved.resolved).toBe(true);
    });

    it('computes line-by-line diffs for AI proposals', () => {
      const diff = AIProposalService.computeDiff('line 1\nold line\nline 3', 'line 1\nnew line\nline 3');
      expect(diff.length).toBeGreaterThan(0);
      expect(diff.some((d) => d.type === 'deleted' && d.text === 'old line')).toBe(true);
      expect(diff.some((d) => d.type === 'added' && d.text === 'new line')).toBe(true);
    });
  });
});
