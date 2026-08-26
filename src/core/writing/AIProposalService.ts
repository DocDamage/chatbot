/**
 * AI Proposal Service (PX14-T06)
 *
 * Implements reviewable AI document proposals with diffs, rationales, rebase handling,
 * and acceptance workflows.
 */

import * as crypto from 'crypto';
import { CanonicalDocumentModel } from './CanonicalDocumentModel';
import {
  AIProposal,
  AIWritingAction,
  CanonicalDocument,
  DiffChunk,
  ProcessingLocality,
  ProposalStatus,
  TextRange
} from './WritingTypes';

export class AIProposalService {
  /**
   * Generates a line-by-line diff between original text and proposed replacement text.
   */
  public static computeDiff(originalText: string, proposedText: string): DiffChunk[] {
    const origLines = originalText.split('\n');
    const propLines = proposedText.split('\n');
    const chunks: DiffChunk[] = [];

    let i = 0;
    let j = 0;
    while (i < origLines.length || j < propLines.length) {
      if (i < origLines.length && j < propLines.length && origLines[i] === propLines[j]) {
        chunks.push({ type: 'unchanged', text: origLines[i], lineIndex: i + 1 });
        i++;
        j++;
      } else if (i < origLines.length && (j >= propLines.length || !propLines.includes(origLines[i]))) {
        chunks.push({ type: 'deleted', text: origLines[i], lineIndex: i + 1 });
        i++;
      } else if (j < propLines.length) {
        chunks.push({ type: 'added', text: propLines[j], lineIndex: j + 1 });
        j++;
      } else {
        i++;
        j++;
      }
    }

    return chunks;
  }

  /**
   * Creates an AI proposal object with diff and metadata.
   */
  public static createProposal(params: {
    document: CanonicalDocument;
    action: AIWritingAction;
    range: TextRange;
    proposedText: string;
    instruction?: string;
    targetTone?: string;
    rationale?: string;
    warnings?: string[];
    providerModel?: string;
    locality?: ProcessingLocality;
  }): AIProposal {
    const { document, action, range, proposedText, instruction, targetTone, rationale, warnings } =
      params;
    const originalText = document.rawText.substring(range.startOffset, range.endOffset);
    const diff = this.computeDiff(originalText, proposedText);

    return {
      id: `prop-${crypto.randomUUID()}`,
      documentId: document.id,
      action,
      instruction,
      targetTone,
      range,
      originalText,
      proposedText,
      diff,
      rationale: rationale || `AI ${action} proposal generated for selected text range.`,
      warnings: warnings || [],
      providerModel: params.providerModel || 'local-cleanroom-qwen-7b',
      locality: params.locality || 'local_only',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Validates if a proposal is still applicable or stale due to underlying document edits.
   */
  public static validateProposalFreshness(
    doc: CanonicalDocument,
    proposal: AIProposal
  ): { isStale: boolean; currentRangeText: string } {
    if (proposal.range.endOffset > doc.rawText.length) {
      return { isStale: true, currentRangeText: '' };
    }
    const currentRangeText = doc.rawText.substring(
      proposal.range.startOffset,
      proposal.range.endOffset
    );
    const isStale = currentRangeText !== proposal.originalText;
    return { isStale, currentRangeText };
  }

  /**
   * Applies an accepted proposal to the document.
   */
  public static applyProposal(
    doc: CanonicalDocument,
    proposal: AIProposal,
    options: { partialChunks?: DiffChunk[] } = {}
  ): { updatedDocument: CanonicalDocument; updatedProposal: AIProposal } {
    const freshness = this.validateProposalFreshness(doc, proposal);
    if (freshness.isStale) {
      proposal.status = 'stale';
      throw new Error(
        `Proposal ${proposal.id} is stale: document content changed since proposal generation.`
      );
    }

    let textToInsert = proposal.proposedText;
    if (options.partialChunks && options.partialChunks.length > 0) {
      // Reconstruct text from selected partial chunks
      const partialLines: string[] = [];
      for (const chunk of options.partialChunks) {
        if (chunk.type === 'unchanged' || chunk.type === 'added') {
          partialLines.push(chunk.text);
        }
      }
      textToInsert = partialLines.join('\n');
      proposal.status = 'partially_accepted';
    } else {
      proposal.status = 'accepted';
    }

    const before = doc.rawText.substring(0, proposal.range.startOffset);
    const after = doc.rawText.substring(proposal.range.endOffset);
    const newRawText = before + textToInsert + after;

    const approvalDigest = CanonicalDocumentModel.computeDigest(
      Buffer.from(`${proposal.id}:${proposal.status}:${new Date().toISOString()}`)
    );

    proposal.acceptedAt = new Date().toISOString();
    proposal.approvalDigest = approvalDigest;

    const updatedDoc: CanonicalDocument = {
      ...doc,
      rawText: newRawText,
      metadata: {
        ...doc.metadata,
        updatedAt: new Date().toISOString(),
        byteSize: Buffer.byteLength(newRawText, 'utf8'),
        sha256Digest: CanonicalDocumentModel.computeDigest(Buffer.from(newRawText, 'utf8'))
      },
      isDirty: true
    };

    return { updatedDocument: updatedDoc, updatedProposal: proposal };
  }

  /**
   * Rejects a proposal.
   */
  public static rejectProposal(proposal: AIProposal): AIProposal {
    proposal.status = 'rejected';
    return proposal;
  }
}
