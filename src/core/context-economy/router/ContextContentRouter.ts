/**
 * Content Classification & Context Compressor Router (PX-03 / PX03-T02)
 * Automatically classifies raw context content (code, diffs, stack traces,
 * logs, JSON, tables, dialogs, trees) and routes to specialized compressors.
 */

import {
  JsonShapeCompressor,
  CodeOutlineCompressor,
  UnifiedDiffCompressor,
  StackTraceDeduplicator,
  LogEventCompressor,
  TableSampleCompressor,
  RepoTreeCompressor,
  ConversationTurnSelector,
  ChatTurn
} from '../compressors';
import { ReversibleContextStore, ReversibleContextRecord } from '../reversible-store/ReversibleContextStore';

export type ContextCategory =
  | 'source_code'
  | 'git_diff'
  | 'stack_trace'
  | 'log_stream'
  | 'json_payload'
  | 'tabular_data'
  | 'repo_tree'
  | 'conversation'
  | 'prose_document'
  | 'unknown';

export interface ClassificationResult {
  category: ContextCategory;
  confidence: number;
  detectedLanguage?: string;
}

export interface CompressionRoutingResult {
  category: ContextCategory;
  originalText: string;
  compressedText: string;
  compressionRatio: number;
  contextRecord?: ReversibleContextRecord;
  diagnostics: {
    omittedItemsCount?: number;
    method: string;
  };
}

export class ContextContentRouter {
  private static instance: ContextContentRouter;
  private store = ReversibleContextStore.getInstance();

  public static getInstance(): ContextContentRouter {
    if (!ContextContentRouter.instance) {
      ContextContentRouter.instance = new ContextContentRouter();
    }
    return ContextContentRouter.instance;
  }

  /**
   * Classifies the given text into an accurate context category.
   */
  public classify(text: string, hint?: { filename?: string; mimeType?: string }): ClassificationResult {
    const trimmed = text.trim();

    if (hint?.filename) {
      if (/\.(json|jsonc)$/i.test(hint.filename)) return { category: 'json_payload', confidence: 0.95 };
      if (/\.(diff|patch)$/i.test(hint.filename)) return { category: 'git_diff', confidence: 0.95 };
      if (/\.(csv|tsv)$/i.test(hint.filename)) return { category: 'tabular_data', confidence: 0.95 };
      if (/\.(log)$/i.test(hint.filename)) return { category: 'log_stream', confidence: 0.9 };
      if (/\.(ts|tsx|js|jsx|py|rs|go|c|cpp|h|java|kt|cs|gd)$/i.test(hint.filename)) {
        return { category: 'source_code', confidence: 0.95, detectedLanguage: hint.filename.split('.').pop() };
      }
    }

    // 1. JSON
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        return { category: 'json_payload', confidence: 0.98 };
      } catch {
        // Not valid JSON
      }
    }

    // 2. Git Diff
    if (trimmed.startsWith('diff --git') || (trimmed.includes('--- a/') && trimmed.includes('+++ b/'))) {
      return { category: 'git_diff', confidence: 0.99 };
    }

    // 3. Stack Trace
    if (/^\w*Error:.*\n\s+at /m.test(trimmed) || /^\s+at\s+[\w$./\\<>]+:\d+:\d+/m.test(trimmed)) {
      return { category: 'stack_trace', confidence: 0.95 };
    }

    // 4. Repo Tree
    if (/^[│├└─\s]+\w+/m.test(trimmed) && (trimmed.includes('├──') || trimmed.includes('└──'))) {
      return { category: 'repo_tree', confidence: 0.92 };
    }

    // 5. Tabular Data (Markdown table or CSV lines)
    if (/^\|?.+\|.+\|\n\|?[-:\s|]+\|/m.test(trimmed)) {
      return { category: 'tabular_data', confidence: 0.9 };
    }

    // 6. Source Code heuristic
    if (/\b(function|class|interface|import\s+.*from|const\s+\w+\s*=|def\s+\w+\(|fn\s+\w+\()/m.test(trimmed)) {
      return { category: 'source_code', confidence: 0.85 };
    }

    // 7. Log Stream
    if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/m.test(trimmed) && trimmed.split('\n').length > 3) {
      return { category: 'log_stream', confidence: 0.85 };
    }

    return { category: 'prose_document', confidence: 0.6 };
  }

  /**
   * Compresses content according to its classified type and registers with reversible store.
   */
  public routeAndCompress(params: {
    text: string;
    ownerId: string;
    projectId?: string;
    filename?: string;
    storeOriginal?: boolean;
  }): CompressionRoutingResult {
    const classification = this.classify(params.text, { filename: params.filename });
    let compressed = params.text;
    let method = 'none';
    let omitted = 0;

    switch (classification.category) {
      case 'json_payload': {
        const res = JsonShapeCompressor.compress(params.text);
        compressed = res.compressed;
        method = 'JsonShapeCompressor';
        omitted = res.omittedFieldsCount;
        break;
      }
      case 'source_code': {
        const res = CodeOutlineCompressor.compress(params.text, params.filename);
        compressed = res.compressedCode;
        method = 'CodeOutlineCompressor';
        omitted = res.omittedLinesCount;
        break;
      }
      case 'git_diff': {
        const res = UnifiedDiffCompressor.compress(params.text);
        compressed = res.compressed;
        method = 'UnifiedDiffCompressor';
        omitted = res.omittedContextLines;
        break;
      }
      case 'stack_trace': {
        const res = StackTraceDeduplicator.compress(params.text);
        compressed = res.compressed;
        method = 'StackTraceDeduplicator';
        omitted = res.prunedFramesCount;
        break;
      }
      case 'log_stream': {
        const res = LogEventCompressor.compress(params.text);
        compressed = res.compressed;
        method = 'LogEventCompressor';
        omitted = res.collapsedLinesCount;
        break;
      }
      case 'tabular_data': {
        const res = TableSampleCompressor.compress(params.text);
        compressed = res.compressed;
        method = 'TableSampleCompressor';
        omitted = res.omittedRowsCount;
        break;
      }
      case 'repo_tree': {
        const res = RepoTreeCompressor.compress(params.text);
        compressed = res.compressed;
        method = 'RepoTreeCompressor';
        omitted = res.prunedEntriesCount;
        break;
      }
      default: {
        compressed = params.text;
        method = 'passthrough';
        omitted = 0;
      }
    }

    let record: ReversibleContextRecord | undefined;
    if (params.storeOriginal !== false) {
      record = this.store.store({
        ownerId: params.ownerId,
        projectId: params.projectId,
        contentType: classification.category,
        originalContent: params.text,
        compressedContent: compressed,
        compressionMethod: method
      });
    }

    const ratio = params.text.length > 0 ? compressed.length / params.text.length : 1;

    return {
      category: classification.category,
      originalText: params.text,
      compressedText: compressed,
      compressionRatio: ratio,
      contextRecord: record,
      diagnostics: {
        method,
        omittedItemsCount: omitted
      }
    };
  }
}
