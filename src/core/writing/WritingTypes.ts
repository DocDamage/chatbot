/**
 * Writing Studio Types (PX-14)
 * Canonical document model, proofreading, AI proposals, tracked changes, and studio state.
 */

export type LineEnding = 'CRLF' | 'LF' | 'CR';
export type BomType = 'utf-8-bom' | 'utf-16le' | 'utf-16be' | 'none';
export type DocumentMaturity = 'draft' | 'review' | 'final' | 'archived';
export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'partially_accepted' | 'stale';
export type ProcessingLocality = 'local_only' | 'cloud_egress' | 'hybrid';
export type DocumentSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';

export interface DocumentSourceMetadata {
  id: string;
  title: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  originalFileName?: string;
  sourceFormat?: string;
  lineEnding: LineEnding;
  bom: BomType;
  hasFinalNewline: boolean;
  byteSize: number;
  sha256Digest: string;
  sensitivity: DocumentSensitivity;
  customFrontmatter?: Record<string, unknown>;
  hiddenComments?: string[];
}

export interface TextRange {
  startOffset: number; // 0-indexed character offset
  endOffset: number;   // 0-indexed character offset
  startLine: number;   // 1-indexed
  endLine: number;     // 1-indexed
  startColumn: number; // 1-indexed
  endColumn: number;   // 1-indexed
}

export interface CanonicalDocument {
  id: string;
  rawText: string;
  metadata: DocumentSourceMetadata;
  astVersion: string;
  isDirty: boolean;
}

export interface HeadingItem {
  id: string;
  level: number; // 1-6
  text: string;
  range: TextRange;
  anchor: string;
}

export interface DocumentOutline {
  headings: HeadingItem[];
  totalWordCount: number;
  totalCharacterCount: number;
  estimatedReadingTimeMinutes: number;
  fleschKincaidReadingEase: number;
}

export type ProofreadingCategory = 'spelling' | 'grammar' | 'punctuation' | 'style' | 'clarity' | 'passive_voice';

export interface ProofreadingSuggestion {
  id: string;
  category: ProofreadingCategory;
  message: string;
  range: TextRange;
  originalText: string;
  replacements: string[];
  ruleId: string;
  ruleDescription: string;
  severity: 'info' | 'warning' | 'error';
  dismissed: boolean;
}

export interface PersonalDictionary {
  words: Set<string>;
  language: string;
}

export type AIWritingAction =
  | 'rewrite'
  | 'concise'
  | 'expand'
  | 'summarize'
  | 'key_points'
  | 'tone'
  | 'format_list'
  | 'format_table'
  | 'explain_review'
  | 'custom';

export interface DiffChunk {
  type: 'unchanged' | 'added' | 'deleted';
  text: string;
  lineIndex?: number;
}

export interface AIProposal {
  id: string;
  documentId: string;
  action: AIWritingAction;
  instruction?: string;
  targetTone?: string;
  range: TextRange;
  originalText: string;
  proposedText: string;
  diff: DiffChunk[];
  rationale?: string;
  warnings?: string[];
  providerModel: string;
  locality: ProcessingLocality;
  status: ProposalStatus;
  createdAt: string;
  acceptedAt?: string;
  approvalDigest?: string;
}

export interface ThreadedComment {
  id: string;
  documentId: string;
  author: string;
  range: TextRange;
  selectedText: string;
  content: string;
  createdAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  replies: Array<{
    id: string;
    author: string;
    content: string;
    createdAt: string;
  }>;
}

export interface TrackedChange {
  id: string;
  documentId: string;
  type: 'insertion' | 'deletion' | 'substitution';
  range: TextRange;
  author: string;
  timestamp: string;
  originalText: string;
  newText: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface DocumentRevision {
  revisionId: string;
  documentId: string;
  timestamp: string;
  author: string;
  commitMessage: string;
  rawText: string;
  sha256Digest: string;
  byteSize: number;
}

export interface AccessibilityPreferences {
  highContrast: boolean;
  reducedMotion: boolean;
  fontSizePx: number;
  lineHeight: number;
  screenReaderAnnouncements: boolean;
  dyslexicFont: boolean;
  focusMode: boolean;
}

export interface WritingStudioState {
  activeDocument: CanonicalDocument | null;
  outline: DocumentOutline;
  suggestions: ProofreadingSuggestion[];
  proposals: AIProposal[];
  comments: ThreadedComment[];
  trackedChanges: TrackedChange[];
  revisions: DocumentRevision[];
  viewMode: 'rich' | 'source' | 'split';
  accessibility: AccessibilityPreferences;
  autosaveStatus: 'saved' | 'saving' | 'dirty' | 'conflict';
  localityNotice: string;
}
