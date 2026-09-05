/**
 * Canonical Document Model (PX14-T01, PX14-T02)
 *
 * Implements byte-exact document parsing, serialization, and round-trip preservation.
 * Raw text remains the single source of truth.
 */

import * as crypto from 'crypto';
import {
  BomType,
  CanonicalDocument,
  DocumentSensitivity,
  DocumentSourceMetadata,
  LineEnding,
  TextRange
} from './WritingTypes';

export class CanonicalDocumentModel {
  public static readonly AST_VERSION = '1.0.0';

  /**
   * Calculates a cryptographic SHA-256 hash of the input string or buffer.
   */
  public static computeDigest(content: string | Buffer): string {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
  }

  /**
   * Detects Byte Order Mark (BOM) in a buffer or string.
   */
  public static detectBOM(buffer: Buffer): { bom: BomType; offset: number } {
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return { bom: 'utf-8-bom', offset: 3 };
    }
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
      return { bom: 'utf-16le', offset: 2 };
    }
    if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
      return { bom: 'utf-16be', offset: 2 };
    }
    return { bom: 'none', offset: 0 };
  }

  /**
   * Detects the dominant line ending format in the raw text.
   */
  public static detectLineEnding(text: string): LineEnding {
    const crlfCount = (text.match(/\r\n/g) || []).length;
    const crCount = (text.match(/\r(?!\n)/g) || []).length;
    const lfCount = (text.match(/(?<!\r)\n/g) || []).length;

    if (crlfCount >= lfCount && crlfCount >= crCount && crlfCount > 0) {
      return 'CRLF';
    }
    if (crCount > lfCount && crCount > crlfCount) {
      return 'CR';
    }
    return 'LF';
  }

  /**
   * Parses raw bytes into a CanonicalDocument preserving byte-level metadata.
   */
  public static parseFromBuffer(
    buffer: Buffer,
    options: {
      id?: string;
      title?: string;
      fileName?: string;
      sensitivity?: DocumentSensitivity;
    } = {}
  ): CanonicalDocument {
    const { bom, offset } = this.detectBOM(buffer);
    const contentBuffer = buffer.subarray(offset);
    let rawText: string;

    if (bom === 'utf-16le') {
      rawText = contentBuffer.toString('utf16le');
    } else {
      rawText = contentBuffer.toString('utf8');
    }

    const lineEnding = this.detectLineEnding(rawText);
    const hasFinalNewline = rawText.endsWith('\n') || rawText.endsWith('\r');
    const sha256Digest = this.computeDigest(buffer);

    const frontmatter = this.extractFrontmatter(rawText);
    const hiddenComments = this.extractHiddenComments(rawText);

    const docId = options.id || `doc-${crypto.randomUUID()}`;
    const title =
      options.title ||
      (frontmatter.metadata?.title as string) ||
      options.fileName?.replace(/\.[^/.]+$/, '') ||
      'Untitled Document';

    const metadata: DocumentSourceMetadata = {
      id: docId,
      title,
      author: (frontmatter.metadata?.author as string) || 'User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
      originalFileName: options.fileName,
      sourceFormat: 'markdown',
      lineEnding,
      bom,
      hasFinalNewline,
      byteSize: buffer.length,
      sha256Digest,
      sensitivity: options.sensitivity || 'internal',
      customFrontmatter: frontmatter.metadata,
      hiddenComments
    };

    return {
      id: docId,
      rawText,
      metadata,
      astVersion: this.AST_VERSION,
      isDirty: false
    };
  }

  /**
   * Parses raw string into a CanonicalDocument.
   */
  public static parseFromString(
    rawText: string,
    options: {
      id?: string;
      title?: string;
      fileName?: string;
      bom?: BomType;
      sensitivity?: DocumentSensitivity;
    } = {}
  ): CanonicalDocument {
    const lineEnding = this.detectLineEnding(rawText);
    const hasFinalNewline = rawText.endsWith('\n') || rawText.endsWith('\r');
    const buffer = this.serializeToBuffer({
      id: options.id || `doc-${crypto.randomUUID()}`,
      rawText,
      metadata: {
        id: options.id || 'temp',
        title: options.title || 'Untitled Document',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        lineEnding,
        bom: options.bom || 'none',
        hasFinalNewline,
        byteSize: 0,
        sha256Digest: '',
        sensitivity: options.sensitivity || 'internal'
      },
      astVersion: this.AST_VERSION,
      isDirty: false
    });

    return this.parseFromBuffer(buffer, options);
  }

  /**
   * Serializes a CanonicalDocument back to a raw Buffer with byte-exact fidelity.
   */
  public static serializeToBuffer(doc: CanonicalDocument): Buffer {
    let textToEncode = doc.rawText;

    // Encode text according to BOM/Encoding
    let textBuffer: Buffer;
    if (doc.metadata.bom === 'utf-16le') {
      textBuffer = Buffer.from(textToEncode, 'utf16le');
    } else {
      textBuffer = Buffer.from(textToEncode, 'utf8');
    }

    // Prepend BOM bytes if required
    let bomBuffer = Buffer.alloc(0);
    if (doc.metadata.bom === 'utf-8-bom') {
      bomBuffer = Buffer.from([0xef, 0xbb, 0xbf]);
    } else if (doc.metadata.bom === 'utf-16le') {
      bomBuffer = Buffer.from([0xff, 0xfe]);
    } else if (doc.metadata.bom === 'utf-16be') {
      bomBuffer = Buffer.from([0xfe, 0xff]);
    }

    return Buffer.concat([bomBuffer, textBuffer]);
  }

  /**
   * Validates byte-for-byte round-trip identity on untouched documents.
   */
  public static verifyLosslessRoundTrip(originalBuffer: Buffer): {
    identical: boolean;
    originalDigest: string;
    serializedDigest: string;
    byteDiffCount: number;
  } {
    const doc = this.parseFromBuffer(originalBuffer);
    const serialized = this.serializeToBuffer(doc);

    const originalDigest = this.computeDigest(originalBuffer);
    const serializedDigest = this.computeDigest(serialized);

    const identical = originalDigest === serializedDigest && originalBuffer.equals(serialized);
    let byteDiffCount = 0;
    if (!identical) {
      const maxLen = Math.max(originalBuffer.length, serialized.length);
      for (let i = 0; i < maxLen; i++) {
        if (originalBuffer[i] !== serialized[i]) byteDiffCount++;
      }
    }

    return {
      identical,
      originalDigest,
      serializedDigest,
      byteDiffCount
    };
  }

  /**
   * Extracts YAML frontmatter without modifying the raw source text.
   */
  public static extractFrontmatter(text: string): {
    metadata?: Record<string, unknown>;
    rawFrontmatter?: string;
  } {
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};

    const raw = match[1];
    const metadata: Record<string, unknown> = {};
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const colIdx = line.indexOf(':');
      if (colIdx > 0) {
        const key = line.substring(0, colIdx).trim();
        const val = line.substring(colIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
        metadata[key] = val;
      }
    }
    return { metadata, rawFrontmatter: match[0] };
  }

  /**
   * Extracts hidden comments (<!-- ... -->) without corrupting source.
   */
  public static extractHiddenComments(text: string): string[] {
    const comments: string[] = [];
    const regex = /<!--([\s\S]*?)-->/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      comments.push(match[1].trim());
    }
    return comments;
  }

  /**
   * Converts character offset (0-indexed) to TextRange (lines and columns 1-indexed).
   */
  public static offsetToRange(text: string, startOffset: number, endOffset: number): TextRange {
    let startLine = 1;
    let startColumn = 1;
    let endLine = 1;
    let endColumn = 1;

    for (let i = 0; i < text.length && i < Math.max(startOffset, endOffset); i++) {
      const isNewline = text[i] === '\n';
      if (i < startOffset) {
        if (isNewline) {
          startLine++;
          startColumn = 1;
        } else {
          startColumn++;
        }
      }
      if (i < endOffset) {
        if (isNewline) {
          endLine++;
          endColumn = 1;
        } else {
          endColumn++;
        }
      }
    }

    return {
      startOffset,
      endOffset,
      startLine,
      endLine,
      startColumn,
      endColumn
    };
  }

  /**
   * Reconciles local edits with concurrent external changes safely.
   */
  public static reconcileConcurrentChanges(params: {
    baseText: string;
    localText: string;
    remoteText: string;
  }): {
    success: boolean;
    mergedText: string;
    hasConflicts: boolean;
    conflicts: Array<{ startLine: number; local: string; remote: string }>;
  } {
    const { baseText, localText, remoteText } = params;

    // Trivial case: no remote change
    if (baseText === remoteText) {
      return { success: true, mergedText: localText, hasConflicts: false, conflicts: [] };
    }
    // Trivial case: no local change
    if (baseText === localText) {
      return { success: true, mergedText: remoteText, hasConflicts: false, conflicts: [] };
    }
    // Both made the exact same change
    if (localText === remoteText) {
      return { success: true, mergedText: localText, hasConflicts: false, conflicts: [] };
    }

    const baseLines = baseText.split('\n');
    const localLines = localText.split('\n');
    const remoteLines = remoteText.split('\n');

    const merged: string[] = [];
    const conflicts: Array<{ startLine: number; local: string; remote: string }> = [];
    let hasConflicts = false;

    const maxLines = Math.max(baseLines.length, localLines.length, remoteLines.length);
    for (let i = 0; i < maxLines; i++) {
      const b = baseLines[i];
      const l = localLines[i];
      const r = remoteLines[i];

      if (l === r) {
        if (l !== undefined) merged.push(l);
      } else if (l === b) {
        if (r !== undefined) merged.push(r);
      } else if (r === b) {
        if (l !== undefined) merged.push(l);
      } else {
        // Conflict
        hasConflicts = true;
        conflicts.push({
          startLine: i + 1,
          local: l ?? '',
          remote: r ?? ''
        });
        merged.push(`<<<<<<< LOCAL\n${l ?? ''}\n=======\n${r ?? ''}\n>>>>>>> REMOTE`);
      }
    }

    return {
      success: !hasConflicts,
      mergedText: merged.join('\n'),
      hasConflicts,
      conflicts
    };
  }
}
