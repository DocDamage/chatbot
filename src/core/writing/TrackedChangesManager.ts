/**
 * Tracked Changes & Comments Manager (PX14-T07)
 *
 * Implements inline threaded comments and tracked changes with accept/reject workflows
 * and portable clean export capabilities.
 */

import * as crypto from 'crypto';
import { CanonicalDocumentModel } from './CanonicalDocumentModel';
import { CanonicalDocument, TextRange, ThreadedComment, TrackedChange } from './WritingTypes';

export class TrackedChangesManager {
  /**
   * Adds a threaded comment to a document.
   */
  public static addComment(
    doc: CanonicalDocument,
    range: TextRange,
    author: string,
    content: string
  ): ThreadedComment {
    const selectedText = doc.rawText.substring(range.startOffset, range.endOffset);
    return {
      id: `comment-${crypto.randomUUID()}`,
      documentId: doc.id,
      author,
      range,
      selectedText,
      content,
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: []
    };
  }

  /**
   * Replies to an existing comment thread.
   */
  public static replyComment(comment: ThreadedComment, author: string, content: string): ThreadedComment {
    comment.replies.push({
      id: `reply-${crypto.randomUUID()}`,
      author,
      content,
      createdAt: new Date().toISOString()
    });
    return comment;
  }

  /**
   * Resolves or reopens a comment.
   */
  public static setCommentResolved(
    comment: ThreadedComment,
    resolved: boolean,
    resolvedBy?: string
  ): ThreadedComment {
    comment.resolved = resolved;
    if (resolved) {
      comment.resolvedAt = new Date().toISOString();
      comment.resolvedBy = resolvedBy || 'User';
    } else {
      comment.resolvedAt = undefined;
      comment.resolvedBy = undefined;
    }
    return comment;
  }

  /**
   * Records a tracked change (insertion, deletion, or substitution).
   */
  public static recordChange(
    doc: CanonicalDocument,
    type: 'insertion' | 'deletion' | 'substitution',
    range: TextRange,
    author: string,
    newText: string
  ): TrackedChange {
    const originalText = doc.rawText.substring(range.startOffset, range.endOffset);
    return {
      id: `change-${crypto.randomUUID()}`,
      documentId: doc.id,
      type,
      range,
      author,
      timestamp: new Date().toISOString(),
      originalText,
      newText,
      status: 'pending'
    };
  }

  /**
   * Accepts a single tracked change, updating the document text.
   */
  public static acceptChange(
    doc: CanonicalDocument,
    change: TrackedChange
  ): { updatedDocument: CanonicalDocument; updatedChange: TrackedChange } {
    if (change.status !== 'pending') {
      return { updatedDocument: doc, updatedChange: change };
    }

    const before = doc.rawText.substring(0, change.range.startOffset);
    const after = doc.rawText.substring(change.range.endOffset);
    const newRawText = before + change.newText + after;

    change.status = 'accepted';

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

    return { updatedDocument: updatedDoc, updatedChange: change };
  }

  /**
   * Rejects a single tracked change.
   */
  public static rejectChange(change: TrackedChange): TrackedChange {
    change.status = 'rejected';
    return change;
  }

  /**
   * Accepts all pending tracked changes sequentially.
   */
  public static acceptAllChanges(
    doc: CanonicalDocument,
    changes: TrackedChange[]
  ): { updatedDocument: CanonicalDocument; updatedChanges: TrackedChange[] } {
    // Sort descending by startOffset so edits don't invalidate preceding offsets
    const sorted = [...changes].sort((a, b) => b.range.startOffset - a.range.startOffset);
    let currentDoc = doc;

    for (const ch of sorted) {
      if (ch.status === 'pending') {
        const res = this.acceptChange(currentDoc, ch);
        currentDoc = res.updatedDocument;
      }
    }

    return { updatedDocument: currentDoc, updatedChanges: changes };
  }

  /**
   * Rejects all pending tracked changes.
   */
  public static rejectAllChanges(changes: TrackedChange[]): TrackedChange[] {
    for (const ch of changes) {
      if (ch.status === 'pending') {
        ch.status = 'rejected';
      }
    }
    return changes;
  }

  /**
   * Exports document with portable CriticMarkup annotations.
   */
  public static exportWithCriticMarkup(doc: CanonicalDocument, changes: TrackedChange[]): string {
    const sorted = [...changes].sort((a, b) => b.range.startOffset - a.range.startOffset);
    let text = doc.rawText;

    for (const ch of sorted) {
      if (ch.status === 'pending') {
        let markup = '';
        if (ch.type === 'insertion') {
          markup = `{++${ch.newText}++}`;
        } else if (ch.type === 'deletion') {
          markup = `{--${ch.originalText}--}`;
        } else {
          markup = `{~~${ch.originalText}~>${ch.newText}~~}`;
        }

        text = text.substring(0, ch.range.startOffset) + markup + text.substring(ch.range.endOffset);
      }
    }

    return text;
  }
}
