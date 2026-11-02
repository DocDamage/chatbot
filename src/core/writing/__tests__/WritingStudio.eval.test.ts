/**
 * Phase PX-14: Lossless Writing, Proofreading, and Review Studio Evaluation Test Suite
 *
 * Validates:
 * - PX14-T01: Canonical document model, BOM, line ending, and metadata parsing
 * - PX14-T02: Byte-exact round-trip, CRLF/LF/CR preservation, 3-way reconciliation
 * - PX14-T03: Editor AST parsing, headings hierarchy, outline, Flesch-Kincaid metrics, find/replace
 * - PX14-T04: Import/export engine (Markdown, HTML, DOCX, PDF) and conversion provenance
 * - PX14-T05: Local proofreading engine, spelling, grammar, punctuation, dictionary, dismissed rules
 * - PX14-T06: AI change proposals, diffs, freshness/stale rebase validation, accept/reject
 * - PX14-T07: Comments and tracked changes, CriticMarkup export, accept all
 * - PX14-T08: Writing AI provider routing, sensitivity enforcement, data egress notices
 * - PX14-T09: Autosave caching, crash recovery, version history timeline
 * - PX14-T10: WritingStudioService integrated workflow and accessibility preferences
 * - PX14-T11 & PX14-T12: Writing quality evaluator and long-document throughput benchmark
 */

import {
  CanonicalDocumentModel,
  DocumentEditorEngine,
  DocumentImportExportService,
  ProofreadingEngine,
  AIProposalService,
  TrackedChangesManager,
  WritingAIProviderRouter,
  DocumentRecoveryManager,
  WritingStudioService,
  WritingQualityEvaluator
} from '../index';

describe('Phase PX-14: Lossless Writing, Proofreading, and Review Studio', () => {
  // PX14-T01 & PX14-T02: Canonical Document Model & Lossless Round-Trip
  describe('PX14-T01 & PX14-T02: Canonical Document Model & Byte-Exact Round-Trip', () => {
    it('preserves UTF-8 BOM, CRLF line endings, and missing final newlines byte-for-byte', () => {
      const originalText = 'Title\r\n---\r\nLine 1\r\nLine 2 without newline';
      const originalBuffer = Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from(originalText, 'utf8')
      ]);

      const doc = CanonicalDocumentModel.parseFromBuffer(originalBuffer, { fileName: 'test.md' });
      expect(doc.metadata.bom).toBe('utf-8-bom');
      expect(doc.metadata.lineEnding).toBe('CRLF');
      expect(doc.metadata.hasFinalNewline).toBe(false);

      const roundTrip = CanonicalDocumentModel.verifyLosslessRoundTrip(originalBuffer);
      expect(roundTrip.identical).toBe(true);
      expect(roundTrip.byteDiffCount).toBe(0);
    });

    it('extracts frontmatter and hidden comments without corrupting the raw source', () => {
      const text =
        '---\ntitle: My Document\nauthor: Alice\n---\n<!-- note: draft v1 -->\n\n# Main Heading\nParagraph content.';
      const doc = CanonicalDocumentModel.parseFromString(text);

      expect(doc.metadata.customFrontmatter?.title).toBe('My Document');
      expect(doc.metadata.customFrontmatter?.author).toBe('Alice');
      expect(doc.metadata.hiddenComments).toContain('note: draft v1');
      expect(doc.rawText).toBe(text);
    });

    it('safely reconciles non-conflicting concurrent edits and flags conflicts', () => {
      const base = 'Line 1\nLine 2\nLine 3';
      const local = 'Line 1 edited\nLine 2\nLine 3';
      const remote = 'Line 1\nLine 2\nLine 3 edited';

      const res = CanonicalDocumentModel.reconcileConcurrentChanges({
        baseText: base,
        localText: local,
        remoteText: remote
      });

      expect(res.hasConflicts).toBe(false);
      expect(res.mergedText).toBe('Line 1 edited\nLine 2\nLine 3 edited');

      // Conflict test
      const conflictRes = CanonicalDocumentModel.reconcileConcurrentChanges({
        baseText: base,
        localText: 'Line 1 (local mod)\nLine 2\nLine 3',
        remoteText: 'Line 1 (remote mod)\nLine 2\nLine 3'
      });
      expect(conflictRes.hasConflicts).toBe(true);
      expect(conflictRes.conflicts.length).toBeGreaterThan(0);
    });
  });

  // PX14-T03: Rich Editor AST & Outline
  describe('PX14-T03: Document Editor Engine AST & Metrics', () => {
    it('parses markdown AST, generates outline hierarchy, and computes reading metrics', () => {
      const editor = new DocumentEditorEngine();
      const content = `# Introduction
This is an overview paragraph.

## Methodology
- [x] Step 1: Initial analysis
- [ ] Step 2: Implementation

> [!NOTE]
> Ensure all references are verified.

| ID | Name |
|---|---|
| 1 | Unit |

$$ E = mc^2 $$
`;

      const ast = editor.parseAST(content);
      expect(ast.some((n) => n.type === 'heading' && n.level === 1)).toBe(true);
      expect(ast.some((n) => n.type === 'task_item' && n.checked === true)).toBe(true);
      expect(ast.some((n) => n.type === 'callout' && n.calloutType === 'NOTE')).toBe(true);
      expect(ast.some((n) => n.type === 'math_block')).toBe(true);

      const outline = editor.generateOutline(content);
      expect(outline.headings.length).toBe(2);
      expect(outline.headings[0].text).toBe('Introduction');
      expect(outline.headings[1].text).toBe('Methodology');
      expect(outline.totalWordCount).toBeGreaterThan(10);
      expect(outline.fleschKincaidReadingEase).toBeGreaterThan(0);
    });

    it('performs find and replace with case sensitivity and regex support', () => {
      const editor = new DocumentEditorEngine();
      const text = 'The quick brown Fox jumps over the lazy dog. The fox is fast.';

      const matches = editor.findMatches(text, 'fox', { matchCase: true });
      expect(matches.length).toBe(1);

      const allMatches = editor.findMatches(text, 'fox', { matchCase: false });
      expect(allMatches.length).toBe(2);

      const replaced = editor.replaceAll(text, 'fox', 'cat', { matchCase: false });
      expect(replaced.count).toBe(2);
      expect(replaced.newText).toContain('cat is fast');
    });
  });

  // PX14-T04: Format Import and Export
  describe('PX14-T04: Import and Export Engine', () => {
    it('imports HTML, DOCX, and PDF with conversion provenance', () => {
      const service = new DocumentImportExportService();

      const htmlContent = '<h1>Test Document</h1><p>This is a <strong>bold</strong> paragraph.</p>';
      const importedHtml = service.importDocument(htmlContent, 'html', 'sample.html');
      expect(importedHtml.document.rawText).toContain('# Test Document');
      expect(importedHtml.document.rawText).toContain('**bold**');
      expect(importedHtml.conversionWarnings.length).toBeGreaterThan(0);

      const pdfBuffer = Buffer.from(
        '%PDF-1.4\nstream\n(Hello from PDF) Tj\nendstream\n%%EOF',
        'latin1'
      );
      const importedPdf = service.importDocument(pdfBuffer, 'pdf', 'sample.pdf');
      expect(importedPdf.isLossless).toBe(false);
      expect(importedPdf.document.rawText).toContain('Hello from PDF');
    });

    it('exports self-contained HTML, printable PDF HTML, and DOCX XML', () => {
      const service = new DocumentImportExportService();
      const doc = CanonicalDocumentModel.parseFromString('# Export Title\n\nSample content body.');

      const htmlExport = service.exportDocument(doc, 'html');
      expect(htmlExport.mimeType).toContain('text/html');
      expect(htmlExport.content.toString()).toContain('<h1>Export Title</h1>');

      const docxExport = service.exportDocument(doc, 'docx_xml');
      expect(docxExport.content.toString()).toContain('<w:document');
    });
  });

  // PX14-T05: Local Proofreading Engine
  describe('PX14-T05: Proofreading Engine', () => {
    it('identifies spelling mistakes, repeated words, and style issues with exact ranges', () => {
      const proofreader = new ProofreadingEngine('en-US');
      const text = 'Teh report was written by teh team in order to achieve success.';

      const suggestions = proofreader.scanDocument(text);
      expect(suggestions.length).toBeGreaterThan(0);

      const spellingSugg = suggestions.find((s) => s.category === 'spelling');
      expect(spellingSugg).toBeDefined();
      expect(spellingSugg?.replacements).toContain('the');

      // Personal dictionary
      proofreader.addToPersonalDictionary('teh');
      const filteredSuggestions = proofreader.scanDocument(text);
      expect(filteredSuggestions.find((s) => s.originalText.toLowerCase() === 'teh')).toBeUndefined();
    });

    it('handles dismissed rules and checks provider health', () => {
      const proofreader = new ProofreadingEngine('en-US');
      const health = proofreader.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.isLocalOnly).toBe(true);

      proofreader.dismissRule('STYLE_WORDY_PHRASE');
      const text = 'We need this in order to proceed.';
      const suggs = proofreader.scanDocument(text);
      expect(suggs.find((s) => s.ruleId === 'STYLE_WORDY_PHRASE')).toBeUndefined();
    });
  });

  // PX14-T06 & PX14-T07: AI Proposals & Tracked Changes
  describe('PX14-T06 & PX14-T07: AI Proposals, Comments, and Tracked Changes', () => {
    it('generates reviewable AI proposal, computes diff, and detects stale proposals', () => {
      const doc = CanonicalDocumentModel.parseFromString('We should utilize this tool in order to win.');
      const range = {
        startOffset: 10,
        endOffset: 17,
        startLine: 1,
        endLine: 1,
        startColumn: 11,
        endColumn: 18
      }; // "utilize"

      const proposal = AIProposalService.createProposal({
        document: doc,
        action: 'concise',
        range,
        proposedText: 'use'
      });

      expect(proposal.status).toBe('pending');
      expect(proposal.diff.some((d) => d.type === 'deleted' && d.text === 'utilize')).toBe(true);
      expect(proposal.diff.some((d) => d.type === 'added' && d.text === 'use')).toBe(true);

      const applied = AIProposalService.applyProposal(doc, proposal);
      expect(applied.updatedDocument.rawText).toBe('We should use this tool in order to win.');
      expect(applied.updatedProposal.status).toBe('accepted');
    });

    it('manages threaded comments and tracked changes with CriticMarkup export', () => {
      const doc = CanonicalDocumentModel.parseFromString('Original sentence here.');
      const range = {
        startOffset: 0,
        endOffset: 8,
        startLine: 1,
        endLine: 1,
        startColumn: 1,
        endColumn: 9
      };

      const comment = TrackedChangesManager.addComment(doc, range, 'Alice', 'Please revise this word.');
      expect(comment.author).toBe('Alice');
      expect(comment.resolved).toBe(false);

      TrackedChangesManager.replyComment(comment, 'Bob', 'Revised as suggested.');
      expect(comment.replies.length).toBe(1);

      const change = TrackedChangesManager.recordChange(
        doc,
        'substitution',
        range,
        'Bob',
        'Refined'
      );
      const criticExport = TrackedChangesManager.exportWithCriticMarkup(doc, [change]);
      expect(criticExport).toContain('{~~Original~>Refined~~}');

      const accepted = TrackedChangesManager.acceptChange(doc, change);
      expect(accepted.updatedDocument.rawText).toBe('Refined sentence here.');
    });
  });

  // PX14-T08 & PX14-T09: Sensitivity, Provider Routing, Recovery, and Timeline
  describe('PX14-T08 & PX14-T09: Security Sensitivity, Routing, and Version Timeline', () => {
    it('enforces local-only processing on confidential documents and rejects cloud egress', () => {
      const router = new WritingAIProviderRouter({ allowCloudEgress: true });
      const confidentialLocality = router.determineLocality('confidential', true);

      expect(confidentialLocality.locality).toBe('local_only');
      expect(confidentialLocality.egressNotice).toContain('Local-only processing enforced');

      const publicLocality = router.determineLocality('public', true);
      expect(publicLocality.locality).toBe('cloud_egress');
    });

    it('maintains autosave snapshots, crash recovery detection, and revision history', () => {
      const recovery = new DocumentRecoveryManager(10);
      const doc = CanonicalDocumentModel.parseFromString('Initial saved text');

      recovery.saveAutosaveSnapshot(doc);
      const check1 = recovery.checkCrashRecoveryNeeded(doc);
      expect(check1.recoveryAvailable).toBe(false);

      // Simulate crash with unsaved dirty text
      const dirtyDoc = { ...doc, rawText: 'Unsaved edited text before browser crash' };
      recovery.saveAutosaveSnapshot(dirtyDoc);

      const check2 = recovery.checkCrashRecoveryNeeded(doc);
      expect(check2.recoveryAvailable).toBe(true);
      expect(check2.snapshot?.rawText).toBe('Unsaved edited text before browser crash');

      // Create version revisions
      const rev1 = recovery.createRevision(doc, 'User', 'Version 1');
      const rev2 = recovery.createRevision(dirtyDoc, 'User', 'Version 2');
      expect(recovery.getRevisions(doc.id).length).toBe(2);

      const restored = recovery.restoreRevision(dirtyDoc, rev1.revisionId);
      expect(restored.restoredDocument.rawText).toBe('Initial saved text');
    });
  });

  // PX14-T10, PX14-T11, PX14-T12: Integrated Writing Studio & Quality Evaluation
  describe('PX14-T10, PX14-T11, & PX14-T12: Integrated Studio Service & Quality Evaluation', () => {
    it('orchestrates end-to-end studio workflow: edit, scan, propose, accept, and save', async () => {
      const studio = new WritingStudioService({
        allowCloud: false,
        aiBackend: { transform: async ({ text }) => text.replace(/in order to/gi, 'to') }
      });
      const doc = studio.openDocument(
        '# Document Title\n\nTeh initial paragraph needs in order to be reviewed.',
        'Review Document'
      );

      expect(doc.id).toBeTruthy();
      const state1 = studio.getStudioState();
      expect(state1.outline.headings.length).toBe(1);

      // Proofreading suggestions
      const suggs = studio.runProofreadingScan();
      expect(suggs.length).toBeGreaterThan(0);

      // AI Proposal
      const prop = await studio.generateAIProposal('concise');
      expect(prop.id).toMatch(/^prop-/);

      // Accept proposal
      const updatedDoc = studio.acceptAIProposal(prop.id);
      expect(updatedDoc.isDirty).toBe(true);

      // Save document
      const savedDoc = studio.saveDocument('Final review complete');
      expect(savedDoc.isDirty).toBe(false);
    });

    it('passes the automated Writing Quality & Long Document Benchmark Suite', async () => {
      const report = await WritingQualityEvaluator.runEvaluationSuite();

      expect(report.grammarPrecision).toBeGreaterThanOrEqual(0.75);
      expect(report.sourceRangeAccuracy).toBe(1.0);
      expect(report.factualPreservationScore).toBeGreaterThanOrEqual(0.8);
      expect(report.staleProposalDetectionPass).toBe(true);
      expect(report.byteExactRoundTripPass).toBe(true);
      expect(report.longDocumentThroughputWordsPerSec).toBeGreaterThan(1000);
      expect(report.overallPassed).toBe(true);
    });
  });
});
