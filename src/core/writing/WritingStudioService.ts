/**
 * Writing Studio Service (PX14-T10)
 *
 * Primary orchestrator service for the Lossless Writing, Proofreading, and Review Studio.
 */

import { AIProposalService } from './AIProposalService';
import { CanonicalDocumentModel } from './CanonicalDocumentModel';
import { DocumentEditorEngine } from './DocumentEditorEngine';
import { DocumentImportExportService } from './DocumentImportExportService';
import { DocumentRecoveryManager } from './DocumentRecoveryManager';
import { ProofreadingEngine } from './ProofreadingEngine';
import { TrackedChangesManager } from './TrackedChangesManager';
import { WritingAIProviderRouter, WritingTransformBackend } from './WritingAIProviderRouter';
import {
  AccessibilityPreferences,
  AIProposal,
  AIWritingAction,
  CanonicalDocument,
  DiffChunk,
  DocumentOutline,
  ProofreadingSuggestion,
  TextRange,
  ThreadedComment,
  TrackedChange,
  WritingStudioState
} from './WritingTypes';

export class WritingStudioService {
  private editorEngine: DocumentEditorEngine;
  private proofreader: ProofreadingEngine;
  private importExport: DocumentImportExportService;
  private recoveryManager: DocumentRecoveryManager;
  private aiRouter: WritingAIProviderRouter;

  private activeDocument: CanonicalDocument | null = null;
  private proposals: Map<string, AIProposal[]> = new Map();
  private comments: Map<string, ThreadedComment[]> = new Map();
  private trackedChanges: Map<string, TrackedChange[]> = new Map();
  private accessibility: AccessibilityPreferences;
  private viewMode: 'rich' | 'source' | 'split' = 'rich';

  constructor(options: { language?: string; allowCloud?: boolean; aiBackend?: WritingTransformBackend } = {}) {
    this.editorEngine = new DocumentEditorEngine();
    this.proofreader = new ProofreadingEngine(options.language || 'en-US');
    this.importExport = new DocumentImportExportService();
    this.recoveryManager = new DocumentRecoveryManager();
    this.aiRouter = new WritingAIProviderRouter({ allowCloudEgress: options.allowCloud ?? false }, options.aiBackend);

    this.accessibility = {
      highContrast: false,
      reducedMotion: false,
      fontSizePx: 16,
      lineHeight: 1.6,
      screenReaderAnnouncements: true,
      dyslexicFont: false,
      focusMode: false
    };
  }

  /**
   * Opens or creates a document.
   */
  public openDocument(rawText: string, title: string = 'Untitled Document'): CanonicalDocument {
    const doc = CanonicalDocumentModel.parseFromString(rawText, { title });
    this.activeDocument = doc;
    this.recoveryManager.createRevision(doc, 'System', 'Initial document open');
    return doc;
  }

  /**
   * Sets the active document.
   */
  public setActiveDocument(doc: CanonicalDocument): void {
    this.activeDocument = doc;
  }

  /**
   * Gets the active document.
   */
  public getActiveDocument(): CanonicalDocument | null {
    return this.activeDocument;
  }

  /**
   * Updates the document text and triggers autosave.
   */
  public updateDocumentText(newText: string): CanonicalDocument {
    if (!this.activeDocument) {
      throw new Error('No active document open in Writing Studio');
    }

    const rawBuffer = Buffer.from(newText, 'utf8');
    this.activeDocument = {
      ...this.activeDocument,
      rawText: newText,
      metadata: {
        ...this.activeDocument.metadata,
        updatedAt: new Date().toISOString(),
        byteSize: rawBuffer.length,
        sha256Digest: CanonicalDocumentModel.computeDigest(rawBuffer)
      },
      isDirty: true
    };

    // Autosave snapshot
    this.recoveryManager.saveAutosaveSnapshot(this.activeDocument);

    return this.activeDocument;
  }

  /**
   * Saves the document and registers a version revision.
   */
  public saveDocument(commitMessage: string = 'Manual save'): CanonicalDocument {
    if (!this.activeDocument) {
      throw new Error('No active document open in Writing Studio');
    }

    this.activeDocument.isDirty = false;
    this.recoveryManager.clearAutosaveSnapshot(this.activeDocument.id);
    this.recoveryManager.createRevision(this.activeDocument, 'User', commitMessage);

    return this.activeDocument;
  }

  /**
   * Retrieves document outline and reading metrics.
   */
  public getOutline(): DocumentOutline {
    if (!this.activeDocument) {
      return {
        headings: [],
        totalWordCount: 0,
        totalCharacterCount: 0,
        estimatedReadingTimeMinutes: 0,
        fleschKincaidReadingEase: 100
      };
    }
    return this.editorEngine.generateOutline(this.activeDocument.rawText);
  }

  /**
   * Runs proofreading check on active document.
   */
  public runProofreadingScan(): ProofreadingSuggestion[] {
    if (!this.activeDocument) return [];
    return this.proofreader.scanDocument(this.activeDocument.rawText);
  }

  /**
   * Generates an AI writing proposal.
   */
  public async generateAIProposal(
    action: AIWritingAction,
    range?: TextRange,
    instruction?: string,
    targetTone?: string,
    preferCloud: boolean = false
  ): Promise<AIProposal> {
    if (!this.activeDocument) {
      throw new Error('No active document open');
    }

    const doc = this.activeDocument;
    const targetRange = range || {
      startOffset: 0,
      endOffset: doc.rawText.length,
      startLine: 1,
      endLine: 1,
      startColumn: 1,
      endColumn: 1
    };

    const transform = await this.aiRouter.executeTransform({
      document: doc,
      action,
      range: targetRange,
      instruction,
      targetTone,
      preferCloud
    });

    const proposal = AIProposalService.createProposal({
      document: doc,
      action,
      range: targetRange,
      proposedText: transform.transformedText,
      instruction,
      targetTone,
      providerModel: transform.providerModel,
      locality: transform.locality,
      rationale: `AI proposal for action: ${action}`
    });

    const docProposals = this.proposals.get(doc.id) || [];
    docProposals.push(proposal);
    this.proposals.set(doc.id, docProposals);

    return proposal;
  }

  /**
   * Accepts an AI proposal.
   */
  public acceptAIProposal(proposalId: string, partialChunks?: DiffChunk[]): CanonicalDocument {
    if (!this.activeDocument) throw new Error('No active document open');

    const docProposals = this.proposals.get(this.activeDocument.id) || [];
    const prop = docProposals.find((p) => p.id === proposalId);
    if (!prop) throw new Error(`Proposal ${proposalId} not found`);

    const result = AIProposalService.applyProposal(this.activeDocument, prop, { partialChunks });
    this.activeDocument = result.updatedDocument;
    this.recoveryManager.saveAutosaveSnapshot(this.activeDocument);

    return this.activeDocument;
  }

  /**
   * Rejects an AI proposal.
   */
  public rejectAIProposal(proposalId: string): AIProposal {
    if (!this.activeDocument) throw new Error('No active document open');
    const docProposals = this.proposals.get(this.activeDocument.id) || [];
    const prop = docProposals.find((p) => p.id === proposalId);
    if (!prop) throw new Error(`Proposal ${proposalId} not found`);

    return AIProposalService.rejectProposal(prop);
  }

  /**
   * Adds a threaded comment.
   */
  public addComment(range: TextRange, author: string, content: string): ThreadedComment {
    if (!this.activeDocument) throw new Error('No active document open');
    const comment = TrackedChangesManager.addComment(this.activeDocument, range, author, content);
    const docComments = this.comments.get(this.activeDocument.id) || [];
    docComments.push(comment);
    this.comments.set(this.activeDocument.id, docComments);
    return comment;
  }

  /**
   * Records a tracked change.
   */
  public recordTrackedChange(
    type: 'insertion' | 'deletion' | 'substitution',
    range: TextRange,
    author: string,
    newText: string
  ): TrackedChange {
    if (!this.activeDocument) throw new Error('No active document open');
    const change = TrackedChangesManager.recordChange(this.activeDocument, type, range, author, newText);
    const docChanges = this.trackedChanges.get(this.activeDocument.id) || [];
    docChanges.push(change);
    this.trackedChanges.set(this.activeDocument.id, docChanges);
    return change;
  }

  /**
   * Accepts all pending tracked changes.
   */
  public acceptAllTrackedChanges(): CanonicalDocument {
    if (!this.activeDocument) throw new Error('No active document open');
    const docChanges = this.trackedChanges.get(this.activeDocument.id) || [];
    const result = TrackedChangesManager.acceptAllChanges(this.activeDocument, docChanges);
    this.activeDocument = result.updatedDocument;
    return this.activeDocument;
  }

  /**
   * Sets accessibility preferences.
   */
  public updateAccessibility(prefs: Partial<AccessibilityPreferences>): AccessibilityPreferences {
    this.accessibility = { ...this.accessibility, ...prefs };
    return this.accessibility;
  }

  /**
   * Sets view mode (rich / source / split).
   */
  public setViewMode(mode: 'rich' | 'source' | 'split'): void {
    this.viewMode = mode;
  }

  /**
   * Returns comprehensive studio state snapshot.
   */
  public getStudioState(): WritingStudioState {
    const docId = this.activeDocument?.id || '';
    const outline = this.getOutline();
    const suggestions = this.runProofreadingScan();
    const proposals = this.proposals.get(docId) || [];
    const comments = this.comments.get(docId) || [];
    const trackedChanges = this.trackedChanges.get(docId) || [];
    const revisions = this.recoveryManager.getRevisions(docId);

    const locality = this.aiRouter.determineLocality(
      this.activeDocument?.metadata.sensitivity || 'internal'
    );

    return {
      activeDocument: this.activeDocument,
      outline,
      suggestions,
      proposals,
      comments,
      trackedChanges,
      revisions,
      viewMode: this.viewMode,
      accessibility: this.accessibility,
      autosaveStatus: this.activeDocument?.isDirty ? 'dirty' : 'saved',
      localityNotice: locality.egressNotice || ''
    };
  }

  // Sub-services accessors
  public getEditorEngine(): DocumentEditorEngine {
    return this.editorEngine;
  }

  public getProofreader(): ProofreadingEngine {
    return this.proofreader;
  }

  public getImportExport(): DocumentImportExportService {
    return this.importExport;
  }

  public getRecoveryManager(): DocumentRecoveryManager {
    return this.recoveryManager;
  }

  public getAIRouter(): WritingAIProviderRouter {
    return this.aiRouter;
  }
}
